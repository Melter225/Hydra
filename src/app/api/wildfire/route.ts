import { NextRequest, NextResponse } from "next/server";

interface DataPoint {
  date: string;
  value: number;
}

interface NasaPowerResponse {
  properties: {
    parameter: {
      GWETPROF: { [key: string]: number };
      GWETROOT: { [key: string]: number };
      GWETTOP: { [key: string]: number };
    };
  };
}

export async function POST(req: NextRequest) {
  const { minLon, minLat, maxLon, maxLat } = await req.json();
  let cachedToken: string | null = null;
  let tokenExpiryTime: number | null = null;
  let isTokenRefreshing = false;
  let tokenRefreshPromise: Promise<string> | null = null;

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const getMonthDateRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      start: formatDate(start),
      end: formatDate(end),
    };
  };

  const analyzeMoisture = (value: number): string => {
    if (value < 0.3) return "very_dry";
    if (value < 0.45) return "dry";
    if (value < 0.6) return "moderate";
    if (value < 0.75) return "wet";
    return "very_wet";
  };

  const getTimeRange = () => {
    const today = new Date();
    const end = `${today.getFullYear()}${parseInt(
      (today.getMonth() + 1).toString().padStart(2, "0")
    )}${parseInt(today.getDate().toString().padStart(2, "0"))}`;

    today.setMonth(today.getMonth() - 1);
    const start = `${today.getFullYear()}${parseInt(
      (today.getMonth() + 1).toString().padStart(2, "0")
    )}${parseInt(today.getDate().toString().padStart(2, "0"))}`;

    return {
      start,
      end,
    };
  };

  function calculateAreaSize(
    minLon: number,
    minLat: number,
    maxLon: number,
    maxLat: number
  ): number {
    const latDistance = (maxLat - minLat) * 111;
    const lonDistance =
      (maxLon - minLon) *
      Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) *
      111;
    return latDistance * lonDistance;
  }

  function determineSampleCount(areaSize: number): number {
    const baseDensity = 100;
    const suggestedCount = Math.ceil((areaSize / 100) * baseDensity);
    return Math.min(Math.max(100, suggestedCount), 400);
  }

  const getSentinelAuthToken = async (
    clientId: string,
    clientSecret: string
  ) => {
    const now = Date.now();

    if (cachedToken && tokenExpiryTime && now < tokenExpiryTime) {
      return cachedToken;
    }

    if (isTokenRefreshing) {
      return tokenRefreshPromise;
    }

    try {
      isTokenRefreshing = true;

      tokenRefreshPromise = (async (): Promise<string> => {
        const response = await fetch(
          "https://services.sentinel-hub.com/oauth/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              client_id: clientId,
              client_secret: clientSecret,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Token request failed: ${response.status} ${errorText}`
          );
        }

        const data = await response.json();

        const BUFFER_TIME = 5 * 60 * 1000;
        cachedToken = data.access_token;
        tokenExpiryTime = now + (data.expires_in * 1000 - BUFFER_TIME);

        return cachedToken || "";
      })();

      return await tokenRefreshPromise;
    } catch (error) {
      cachedToken = null;
      tokenExpiryTime = null;
      throw error;
    } finally {
      isTokenRefreshing = false;
      tokenRefreshPromise = null;
    }
  };

  const getVegetationData = async (
    lat: number,
    lon: number,
    date: Date,
    bufferDegrees: number
  ) => {
    const { start, end } = getMonthDateRange(date);

    const authToken = await getSentinelAuthToken(
      process.env.SENTINEL_CLIENT_ID!,
      process.env.SENTINEL_CLIENT_SECRET!
    );

    try {
      const requestBody = {
        input: {
          bounds: {
            bbox: [
              lon - bufferDegrees,
              lat - bufferDegrees,
              lon + bufferDegrees,
              lat + bufferDegrees,
            ],
            properties: {
              crs: "http://www.opengis.net/def/crs/EPSG/0/4326",
            },
          },
          data: [
            {
              dataFilter: {
                timeRange: {
                  from: start + "T00:00:00Z",
                  to: end + "T23:59:59Z",
                },
                maxCloudCoverage: 20,
              },
              type: "S2L2A",
            },
          ],
        },
        output: {
          width: 100,
          height: 100,
          responses: [
            {
              identifier: "default",
              format: {
                type: "image/png",
              },
            },
          ],
        },
        evalscript: `
        //VERSION=3
        function setup() {
          return {
            input: ["B04", "B08"],
            output: [{
              id: "default",
              bands: 3,
              sampleType: "UINT8"
            }]
          }
        }

        function evaluatePixel(sample) {
          let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
          let ndre = (sample.B08 - sample.B05) / (sample.B08 + sample.B05);
          let psri = (sample.B04 - sample.B02) / sample.B06;
          let savi = ((sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.5)) * (1.5);

          let vegetationType;
          if (ndvi < 0.2) {
            vegetationType = "non-vegetated";
          } else if (ndre > 0.4 && psri < -0.1) {
            vegetationType = "forest";
          } else if (ndre > 0.2 && psri < 0) {
            vegetationType = "shrubland";
          } else {
            vegetationType = "grassland";
          }

          return [
            255 * Math.max(0, Math.min(1, (ndre + 0.5))),
            255 * Math.max(0, Math.min(1, (ndvi + 1) / 2)),
            255 * (1 - Math.max(0, Math.min(1, savi)))
          ];
        }
      `,
      };

      const response = await fetch(
        `https://services.sentinel-hub.com/api/v1/process`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Sentinel Hub Error Response:", {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        throw new Error(
          `Sentinel Hub API error: ${response.status} ${response.statusText}`
        );
      }

      const imageData = await response.arrayBuffer();
      const uint8Array = new Uint8Array(imageData);

      const redValues = [];
      const greenValues = [];
      const blueValues = [];

      for (let i = 0; i < uint8Array.length; i += 3) {
        redValues.push(uint8Array[i]);
        greenValues.push(uint8Array[i + 1]);
        blueValues.push(uint8Array[i + 2]);
      }

      const calculateStats = (values: number[]) => {
        const validValues = values.filter((v) => v !== null && !isNaN(v));
        return {
          min: Math.min(...validValues) / 255,
          max: Math.max(...validValues) / 255,
          average:
            validValues.reduce((a, b) => a + b, 0) / (validValues.length * 255),
        };
      };

      const ndviStats = calculateStats(greenValues);
      const ndreStats = calculateStats(redValues);
      const soilInfluenceStats = calculateStats(blueValues);

      const determineVegetationType = () => {
        const avgNdre = ndreStats.average;
        const avgNdvi = ndviStats.average;
        const avgSoil = soilInfluenceStats.average;

        if (avgNdvi < 0.2) return "non-vegetated";
        if (avgNdre > 0.4 && avgSoil < 0.3) return "forest";
        if (avgNdre > 0.2 && avgSoil < 0.5) return "shrubland";
        return "grassland";
      };

      const determineVegetationDensity = () => {
        if (ndviStats.average < 0.2) return "barren";
        if (ndviStats.average < 0.4) return "sparse";
        if (ndviStats.average < 0.6) return "moderate";
        return "dense";
      };

      return {
        ndviStats,
        spectralStats: {
          woodyContent: ndreStats,
          soilInfluence: soilInfluenceStats,
        },
        classification: {
          vegetationType: determineVegetationType(),
          vegetationDensity: determineVegetationDensity(),
        },
        metadata: {
          timestamp: new Date().toISOString(),
          coordinates: { lat, lon },
          bbox: `${lon - bufferDegrees},${lat - bufferDegrees},${
            lon + bufferDegrees
          },${lat + bufferDegrees}`,
          resolution: "100x100 pixels",
          timeRange: { start, end },
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch vegetation data: ${error.message}`);
      } else {
        throw new Error("Failed to fetch vegetation data");
      }
    }
  };

  const getSoilMoisture = async (lat: string, lon: string) => {
    try {
      const { start, end } = getTimeRange();

      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?start=${parseInt(
        start
      )}&end=${parseInt(
        end
      )}&latitude=${lat}&longitude=${lon}&community=AG&parameters=GWETPROF,GWETROOT,GWETTOP&format=JSON`;

      const response = await fetch(url);
      const rawData = await response.text();

      if (!response.ok) {
        console.error(
          "API Error:",
          response.status,
          response.statusText,
          rawData
        );
        return NextResponse.json(
          { error: "Error fetching data from NASA POWER" },
          { status: response.status }
        );
      }

      const data: NasaPowerResponse = JSON.parse(rawData);
      const dates = Object.keys(data.properties.parameter.GWETPROF);
      const mostRecentDate =
        dates.find((date) => {
          const profile = data.properties.parameter.GWETPROF[date];
          const root = data.properties.parameter.GWETROOT[date];
          const surface = data.properties.parameter.GWETTOP[date];
          return profile !== -999 && root !== -999 && surface !== -999;
        }) || dates[0];

      const soilData = {
        timestamp: new Date().toISOString(),
        coordinates: {
          lat: parseFloat(lat),
          lon: parseFloat(lon),
        },
        soil_moisture: {
          profile: data.properties.parameter.GWETPROF[mostRecentDate],
          root_zone: data.properties.parameter.GWETROOT[mostRecentDate],
          surface: data.properties.parameter.GWETTOP[mostRecentDate],
        },
        categorization: {
          profile: analyzeMoisture(
            data.properties.parameter.GWETPROF[mostRecentDate]
          ),
          root_zone: analyzeMoisture(
            data.properties.parameter.GWETROOT[mostRecentDate]
          ),
          surface: analyzeMoisture(
            data.properties.parameter.GWETTOP[mostRecentDate]
          ),
        },
        trends: { profile: "none", root_zone: "none", surface: "none" },
        metadata: {
          date: mostRecentDate,
          source: "NASA POWER",
          units: "% volumetric soil moisture",
          depths: {
            profile: "0-200cm",
            root_zone: "10-100cm",
            surface: "0-10cm",
          },
        },
      };

      const calculateTrend = (data: DataPoint[]) => {
        const validData = data.filter((point) => point.value !== -999);

        if (validData.length === 0) return null;

        const average =
          validData.reduce((sum, item) => sum + item.value, 0) /
          validData.length;

        return validData[validData.length - 2].value >
          validData[validData.length - 1].value
          ? validData[0].value < average
            ? "decreasing"
            : "none"
          : validData[0].value > average
          ? "increasing"
          : "none";
      };

      soilData.trends = {
        profile:
          calculateTrend(
            dates.map((date) => ({
              date,
              value: data.properties.parameter.GWETPROF[date],
            }))
          ) || "none",
        root_zone:
          calculateTrend(
            dates.map((date) => ({
              date,
              value: data.properties.parameter.GWETROOT[date],
            }))
          ) || "none",
        surface:
          calculateTrend(
            dates.map((date) => ({
              date,
              value: data.properties.parameter.GWETTOP[date],
            }))
          ) || "none",
      };

      return {
        timestamp: soilData.timestamp,
        coordinates: soilData.coordinates,
        soil_moisture: soilData.soil_moisture,
        metaData: soilData.metadata,
      };
    } catch (error) {
      console.error("Error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };

  async function isLandPoint(lat: number, lon: number): Promise<boolean> {
    try {
      const response = await fetch(
        `https://is-on-water.balbona.me/api/v1/get/${lat}/${lon}`
      );

      if (!response.ok) {
        console.warn(`Is-on-water API error for point ${lat},${lon}`);
        return false;
      }

      const data = await response.json();
      console.log(!data.isWater === true);

      return !data.isWater === true;
    } catch (error) {
      console.warn(`Error checking point ${lat},${lon}:`, error);
      return false;
    }
  }

  async function generateGridPoints(
    minLon: number,
    minLat: number,
    maxLon: number,
    maxLat: number,
    count: number
  ) {
    const points = [];

    const areaRatio = (maxLon - minLon) / (maxLat - minLat);
    let gridHeight = Math.sqrt(count / areaRatio);
    if (gridHeight - Math.trunc(gridHeight) >= 0.5) {
      gridHeight = Math.ceil(gridHeight);
    } else {
      gridHeight = Math.floor(gridHeight);
    }

    const gridWidth = gridHeight * areaRatio;

    const latStep = (maxLat - minLat) / (gridHeight - 1);
    const lonStep = (maxLon - minLon) / (gridWidth - 1);

    for (let i = 0; i < gridHeight; i++) {
      for (let j = 0; j < gridWidth; j++) {
        const point = {
          lat: minLat + i * latStep,
          lon: minLon + j * lonStep,
        };

        const isLand = await isLandPoint(point.lat, point.lon);
        if (isLand) {
          points.push(point);
        }
      }
    }

    const limitedPoints = points.slice(0, count);

    try {
      const environmentalPoints = await Promise.all(
        limitedPoints.map(async (point) => {
          const vegetationData = await getVegetationData(
            point.lat,
            point.lon,
            new Date(),
            0.1
          );

          const soilMoisture = await getSoilMoisture(
            point.lat.toString(),
            point.lon.toString()
          );

          const weatherResponse = await fetch(
            `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${point.lat},${point.lon}`
          );
          const weatherData = await weatherResponse.json();

          const getSlopeData = async (latitude: string, longitude: string) => {
            const DELTA = 0.001;
            const lat = parseFloat(latitude);
            const lon = parseFloat(longitude);

            const points = [
              { lat: lat + DELTA, lon },
              { lat: lat - DELTA, lon },
              { lat, lon: lon + DELTA },
              { lat, lon: lon - DELTA },
            ];

            try {
              const elevations = await Promise.all(
                points.map(async (point) => {
                  const response = await fetch(
                    `https://api.opentopodata.org/v1/aster30m?locations=${point.lat},${point.lon}`
                  );
                  const data = await response.json();
                  return data.results[0].elevation;
                })
              );

              const maxElevDiff =
                Math.max(...elevations) - Math.min(...elevations);
              const horizontalDistance = 2 * DELTA * 111000;
              const slopeAngle =
                Math.atan(maxElevDiff / horizontalDistance) * (180 / Math.PI);

              return Math.min(Math.abs(slopeAngle) * (100 / 90), 100) || 0;
            } catch {
              return 0;
            }
          };

          if ("soil_moisture" in soilMoisture) {
            return {
              point,
              location: weatherData.location.name,
              temperature: weatherData.current.temperature,
              humidity: weatherData.current.humidity,
              windSpeed: weatherData.current.wind_speed,
              windDirection: weatherData.current.wind_degree,
              vegetationDensity: vegetationData.ndviStats.average,
              soilMoisture: {
                surface: soilMoisture.soil_moisture.surface,
                rootZone: soilMoisture.soil_moisture.root_zone,
                profile: soilMoisture.soil_moisture.profile,
              },
              topography: {
                slope: await getSlopeData(
                  point.lat.toString(),
                  point.lon.toString()
                ),
              },
            };
          } else {
            return {
              point,
              location: weatherData.location.name,
              temperature: weatherData.current.temperature,
              humidity: weatherData.current.humidity,
              windSpeed: weatherData.wind_speed,
              windDirection: weatherData.wind_degree,
              vegetationDensity: vegetationData.ndviStats.average,
              soilMoisture: {
                surface: -999,
                rootZone: -999,
                profile: -999,
              },
              topography: {
                slope: await getSlopeData(
                  point.lat.toString(),
                  point.lon.toString()
                ),
              },
            };
          }
        })
      );

      console.log(environmentalPoints);
      return environmentalPoints;
    } catch (error) {
      console.error("Error generating environmental points:", error);
      throw error;
    }
  }

  try {
    const environmentalData = await generateGridPoints(
      minLon,
      minLat,
      maxLon,
      maxLat,
      determineSampleCount(calculateAreaSize(minLon, minLat, maxLon, maxLat))
    );

    const gptResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: `Given an area bounded by coordinates (minLat: ${minLat}, maxLat: ${maxLat}, minLon: ${minLon}, maxLon: ${maxLon}), and the following environmental data:
              ${JSON.stringify(environmentalData, null, 2)}
              Based on this data, identify the three distinct sub-regions within the given area that are most at risk of wildfires. Return only a JSON array containing exactly three objects, each with minLat, maxLat, minLon, maxLon, and severity (0-1) properties. The sub-regions can overlap. Format:
              [
                {"minLat": number, "maxLat": number, "minLon": number, "maxLon": number, "severity": number},
                {"minLat": number, "maxLat": number, "minLon": number, "maxLon": number, "severity": number},
                {"minLat": number, "maxLat": number, "minLon": number, "maxLon": number, "severity": number}
              ]`,
            },
          ],
          temperature: 0.2,
        }),
      }
    );

    const gptData = await gptResponse.json();
    const locations = JSON.parse(gptData.choices[0].message.content);

    return NextResponse.json({
      locationName: environmentalData[0].location,
      locations,
      reason: "placeholder reason text",
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({
      error: "Error fetching locations most prone to a wildfire.",
      status: 500,
    });
  }
}
