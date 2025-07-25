import { NextRequest, NextResponse } from "next/server";

type Point = {
  lat: number;
  lon: number;
};

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

interface SoilMoisture {
  surface: number;
  rootZone: number;
  profile: number;
}

interface Topography {
  slope: number;
}

type EnvironmentalData = {
  point: Point;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  vegetationDensity: number;
  soilMoisture: SoilMoisture;
  topography: Topography;
};

type Cluster = {
  points: EnvironmentalData[];
  center: Point;
  averageConditions: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    vegetationDensity: number;
  };
};

interface DataAccumulator {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  vegetationDensity: number;
  soilMoisture: SoilMoisture;
  topography: Topography;
}

type ClusterScore = {
  bestPoint: Point;
  bestScore: number;
};

// interface PredictionResult {
//   success: boolean;
//   frp?: number;
//   location?: {
//     latitude: number;
//     longitude: number;
//   };
//   features_used?: number[];
//   error?: string;
// }

interface NasaPowerTemporalData {
  properties: {
    parameter: {
      T2M: Record<string, number>;
      PRECTOTCORR: Record<string, number>;
      RH2M: Record<string, number>;
      ALLSKY_SFC_SW_DWN: Record<string, number>;
      GWETPROF: Record<string, number>;
    };
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://hydraapp.vercel.app",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  let {
    minLat,
    maxLat,
    minLon,
    maxLon,
  }: {
    minLat: number | undefined;
    maxLat: number | undefined;
    minLon: number | undefined;
    maxLon: number | undefined;
  } = {
    minLat: undefined,
    maxLat: undefined,
    minLon: undefined,
    maxLon: undefined,
  };
  let coordinates: { lat: number; lng: number }[] | undefined = undefined;

  if (body.minLat && body.minLon && body.maxLat && body.maxLon) {
    ({ minLat, maxLat, minLon, maxLon } = body);
  } else {
    coordinates = body.coordinates;
  }

  let cachedToken: string | null = null;
  let tokenExpiryTime: number | null = null;
  let isTokenRefreshing = false;
  let tokenRefreshPromise: Promise<string> | null = null;

  // console.log(minLon, minLat, maxLon, maxLat);

  function calculateAreaSize(
    minLon?: number,
    minLat?: number,
    maxLon?: number,
    maxLat?: number,
    coordinates?: { lat: number; lng: number }[]
  ): number {
    if (!minLon || !minLat || !maxLon || !maxLat) {
      if (coordinates) {
        let lats = coordinates.map((coord) => coord.lat);
        let lons = coordinates.map((coord) => coord.lng);
        lats = lats.sort((a, b) => a - b);
        lons = lons.sort((a, b) => a - b);

        minLon = 0.5 * (lons[0] + lons[1]);
        minLat = 0.5 * (lats[0] + lats[1]);
        maxLon = 0.5 * (lons[lons.length - 2] + lons[lons.length - 1]);
        maxLat = 0.5 * (lats[lats.length - 2] + lats[lats.length - 1]);
      } else {
        throw new Error(
          "Either coordinates or bounding box (minLon, minLat, maxLon, maxLat) must be provided"
        );
      }
    }

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
    return Math.min(Math.max(30, suggestedCount), 400);
  }

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
    console.log(`Attempting to get vegetation data for ${lat},${lon}`);
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

      console.log(
        `Successfully got vegetation data: ${JSON.stringify(ndviStats)}`
      );

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

  const analyzeMoisture = (value: number): string => {
    if (value < 0.3) return "very_dry";
    if (value < 0.45) return "dry";
    if (value < 0.6) return "moderate";
    if (value < 0.75) return "wet";
    return "very_wet";
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
        // historical: {
        //   dates: dates,
        //   profile: dates.map((date) => ({
        //     date,
        //     value: data.properties.parameter.GWETPROF[date],
        //   })),
        //   root_zone: dates.map((date) => ({
        //     date,
        //     value: data.properties.parameter.GWETROOT[date],
        //   })),
        //   surface: dates.map((date) => ({
        //     date,
        //     value: data.properties.parameter.GWETTOP[date],
        //   })),
        // },
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

      // console.log("Soil data:", soilData);
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

  async function isRuralPoint(lat: number, lon: number): Promise<boolean> {
    const radiusInMeters = 1609.345;

    const query = `
    [out:json];
    (
      // Look for commercial buildings, retail, industrial areas
      node["building"="commercial"](around:${radiusInMeters},${lat},${lon});
      way["building"="commercial"](around:${radiusInMeters},${lat},${lon});
      node["building"="industrial"](around:${radiusInMeters},${lat},${lon});
      way["building"="industrial"](around:${radiusInMeters},${lat},${lon});
      relation["landuse"="industrial"](around:${radiusInMeters},${lat},${lon});
      relation["landuse"="commercial"](around:${radiusInMeters},${lat},${lon});
    );
    out count;
  `;

    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const urbanFeatureThreshold = 6;
      return data.elements.length < urbanFeatureThreshold;
    } catch (error) {
      console.error("Error checking if point is rural:", error);
      return false;
    }
  }

  const isPointInPolygon = (
    lat: number,
    lon: number,
    coordinates?: { lat: number; lng: number }[]
  ) => {
    if (!coordinates || coordinates.length < 4) {
      return true;
    }

    let inside = false;
    const x = lon;
    const y = lat;

    for (
      let i = 0, j = coordinates.length - 1;
      i < coordinates.length;
      j = i, i++
    ) {
      const xi = coordinates[i].lng;
      const yi = coordinates[i].lat;
      const xj = coordinates[j].lng;
      const yj = coordinates[j].lat;

      if (xi === x && yi === y) {
        return true;
      }

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  };

  async function generateGridPoints(
    count: number,
    minLon?: number,
    minLat?: number,
    maxLon?: number,
    maxLat?: number,
    coordinates?: { lat: number; lng: number }[]
  ) {
    if (!minLon || !minLat || !maxLon || !maxLat) {
      if (coordinates) {
        minLon = Math.min(...coordinates.map((c) => c.lng));
        minLat = Math.min(...coordinates.map((c) => c.lat));
        maxLon = Math.max(...coordinates.map((c) => c.lng));
        maxLat = Math.max(...coordinates.map((c) => c.lat));
      } else {
        throw new Error(
          "Either coordinates or bounding box (minLon, minLat, maxLon, maxLat) must be provided"
        );
      }
    }

    console.log(
      `Generating grid with bounds: ${minLon}, ${minLat}, ${maxLon}, ${maxLat}`
    );
    console.log(`Target point count: ${count}`);
    const points = [];

    const areaRatio = Math.abs(maxLon - minLon) / (maxLat - minLat);
    let gridHeight = Math.sqrt(count / areaRatio);
    if (gridHeight - Math.trunc(gridHeight) >= 0.5) {
      gridHeight = Math.ceil(gridHeight);
    } else {
      gridHeight = Math.floor(gridHeight);
    }

    console.log(maxLon, minLon);
    console.log(count, areaRatio, count / areaRatio, gridHeight);

    const gridWidth = gridHeight * areaRatio;
    console.log(areaRatio, gridHeight, gridWidth);

    const latStep = (maxLat - minLat) / (gridHeight - 1 || 1);
    const lonStep = (maxLon - minLon) / (gridWidth - 1 || 1);
    console.log(latStep, lonStep);

    for (let i = 0; i < gridHeight; i++) {
      for (let j = 0; j < gridWidth; j++) {
        console.log(i, j);
        const point = {
          lat: minLat + i * latStep,
          lon: minLon + j * lonStep,
        };

        const isLand = await isLandPoint(point.lat, point.lon);
        const isRural = await isRuralPoint(point.lat, point.lon);
        const isInside = isPointInPolygon(
          point.lat,
          point.lon,
          coordinates || undefined
        );

        if (isLand && isRural && isInside) {
          points.push(point);
        }
      }
    }

    console.log("points", points);

    const limitedPoints = points.slice(0, count);
    // const limitedPoints = points;

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

          console.log(
            weatherData,
            vegetationData,
            soilMoisture,
            await getSlopeData(point.lat.toString(), point.lon.toString())
          );

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

  function toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  function calculateDistance(p1: Point, p2: Point): number {
    const R = 6371;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);
    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calculateClusterCenter(points: EnvironmentalData[]): Point {
    const sumLat = points.reduce((sum, p) => sum + p.point.lat, 0);
    const sumLon = points.reduce((sum, p) => sum + p.point.lon, 0);
    return {
      lat: sumLat / points.length,
      lon: sumLon / points.length,
    };
  }

  function calculateAverageConditions(points: EnvironmentalData[]) {
    const sum = points.reduce<DataAccumulator>(
      (acc, p) => {
        return {
          temperature: acc.temperature + p.temperature,
          humidity: acc.humidity + p.humidity,
          windSpeed: acc.windSpeed + p.windSpeed,
          windDirection: acc.windDirection + p.windDirection,
          vegetationDensity: acc.vegetationDensity + p.vegetationDensity,
          soilMoisture: {
            surface: acc.soilMoisture.surface + p.soilMoisture.surface,
            rootZone: acc.soilMoisture.rootZone + p.soilMoisture.rootZone,
            profile: acc.soilMoisture.profile + p.soilMoisture.profile,
          },
          topography: {
            slope: acc.topography.slope + p.topography.slope,
          },
        };
      },
      {
        temperature: 0,
        humidity: 0,
        windSpeed: 0,
        windDirection: 0,
        vegetationDensity: 0,
        soilMoisture: {
          surface: 0,
          rootZone: 0,
          profile: 0,
        },
        topography: {
          slope: 0,
        },
      }
    );

    return {
      temperature: sum.temperature / points.length,
      humidity: sum.humidity / points.length,
      windSpeed: sum.windSpeed / points.length,
      windDirection: sum.windDirection / points.length,
      vegetationDensity: sum.vegetationDensity / points.length,
      soilMoisture: {
        surface: sum.soilMoisture.surface / points.length,
        rootZone: sum.soilMoisture.rootZone / points.length,
        profile: sum.soilMoisture.profile / points.length,
      },
      topography: {
        slope: sum.topography.slope / points.length,
      },
    };
  }

  function findEnvironmentalClusters(
    data: EnvironmentalData[],
    maxClusterRadius: number = 5,
    minPointsPerCluster: number = 5
  ): Cluster[] {
    const clusters: Cluster[] = [];
    const unvisited = [...data];

    while (unvisited.length > 0) {
      const current = unvisited[0];
      const clusterPoints = [current];
      unvisited.splice(0, 1);

      for (let i = unvisited.length - 1; i >= 0; i--) {
        const point = unvisited[i];
        if (calculateDistance(current.point, point.point) <= maxClusterRadius) {
          clusterPoints.push(point);
          unvisited.splice(i, 1);
        }
      }

      if (clusterPoints.length >= minPointsPerCluster) {
        clusters.push({
          points: clusterPoints,
          center: calculateClusterCenter(clusterPoints),
          averageConditions: calculateAverageConditions(clusterPoints),
        });
      }
    }

    return clusters;
  }

  const findClusterScores = (clusters: Cluster[]): ClusterScore[] => {
    console.log("test");
    return clusters.map((cluster) => {
      console.log(cluster);
      const pointScores = cluster.points.map((point) => {
        console.log(point);
        let score = 0;
        // let multifactor = false;

        let priority = [
          { factor: "type and density of vegetation", url: "" },
          { factor: "temperature and humidity", url: "" },
          { factor: "wind speed and direction", url: "" },
          { factor: "soil moisture", url: "" },
          { factor: "topography", url: "" },
        ];

        // const basePriority = [
        //   { factor: "type and density of vegetation", url: "" },
        //   { factor: "temperature and humidity", url: "" },
        //   { factor: "wind speed and direction", url: "" },
        //   { factor: "soil moisture", url: "" },
        //   { factor: "topography", url: "" },
        // ];

        // const multifactorPriority = [
        //   { factor: "wind speed and direction", url: "" },
        //   { factor: "temperature and humidity", url: "" },
        //   { factor: "type and density of vegetation", url: "" },
        //   { factor: "soil moisture", url: "" },
        //   { factor: "topography", url: "" },
        // ];

        if (point.vegetationDensity < 0.4) {
          priority = [
            { factor: "temperature and humidity", url: "" },
            { factor: "wind speed and direction", url: "" },
            { factor: "soil moisture", url: "" },
            { factor: "type and density of vegetation", url: "" },
            { factor: "topography", url: "" },
          ];
        } else if (point.temperature >= 35 || point.humidity <= 15) {
          priority = [
            { factor: "temperature and humidity", url: "" },
            { factor: "type and density of vegetation", url: "" },
            { factor: "wind speed and direction", url: "" },
            { factor: "topography", url: "" },
            { factor: "soil moisture", url: "" },
          ];
        } else if (point.windSpeed * 2.237 > 20) {
          priority = [
            { factor: "wind speed and direction", url: "" },
            { factor: "type and density of vegetation", url: "" },
            { factor: "temperature and humidity", url: "" },
            { factor: "topography", url: "" },
            { factor: "soil moisture", url: "" },
          ];
        } else if (
          point.soilMoisture.surface <= 0.2 ||
          point.soilMoisture.rootZone <= 0.3 ||
          point.soilMoisture.profile <= 0.35
        ) {
          priority = [
            { factor: "type and density of vegetation", url: "" },
            { factor: "soil moisture", url: "" },
            { factor: "temperature and humidity", url: "" },
            { factor: "wind speed and direction", url: "" },
            { factor: "topography", url: "" },
          ];
        } else if (point.topography.slope >= 30) {
          priority = [
            { factor: "type and density of vegetation", url: "" },
            { factor: "temperature and humidity", url: "" },
            { factor: "topography", url: "" },
            { factor: "wind speed and direction", url: "" },
            { factor: "soil moisture", url: "" },
          ];
        } else if (
          [
            point.vegetationDensity < 0.4,
            point.temperature >= 35 || point.humidity <= 15,
            point.windSpeed * 2.237 > 20,
            point.soilMoisture.surface <= 0.2 ||
              point.soilMoisture.rootZone <= 0.3 ||
              point.soilMoisture.profile <= 0.35,
            point.topography.slope >= 30,
          ].filter(Boolean).length >= 2
        ) {
          if (point.windSpeed * 2.237 > 20) {
            priority[0] = { factor: "wind speed and direction", url: "" };
            if (
              point.soilMoisture.surface <= 0.2 ||
              point.soilMoisture.rootZone <= 0.3 ||
              point.soilMoisture.profile <= 0.35
            ) {
              priority[1] = { factor: "soil moisture", url: "" };
              if (point.temperature >= 35 || point.humidity <= 15) {
                priority[2] = { factor: "temperature and humidity", url: "" };
                priority[3] = {
                  factor: "type and density of vegetation",
                  url: "",
                };
              } else {
                priority[2] = {
                  factor: "type and density of vegetation",
                  url: "",
                };
                priority[3] = { factor: "temperature and humidity", url: "" };
              }
            } else {
              if (point.temperature >= 35 || point.humidity <= 15) {
                priority[1] = { factor: "temperature and humidity", url: "" };
                priority[2] = {
                  factor: "type and density of vegetation",
                  url: "",
                };
              } else {
                priority[1] = {
                  factor: "type and density of vegetation",
                  url: "",
                };
                priority[2] = { factor: "temperature and humidity", url: "" };
              }

              if (point.topography.slope >= 30) {
                priority[3] = { factor: "topography", url: "" };
                priority[4] = { factor: "soil moisture", url: "" };
              }
            }
          } else if (point.temperature >= 35 || point.humidity <= 15) {
            priority[0] = { factor: "temperature and humidity", url: "" };
            if (
              point.soilMoisture.surface <= 0.2 ||
              point.soilMoisture.rootZone <= 0.3 ||
              point.soilMoisture.profile <= 0.35
            ) {
              priority[1] = { factor: "soil moisture", url: "" };
            }

            priority[2] = { factor: "type and density of vegetation", url: "" };
            priority[3] = { factor: "wind speed and direction", url: "" };

            if (point.topography.slope >= 30) {
              priority[3] = { factor: "topography", url: "" };
              priority[4] = { factor: "soil moisture", url: "" };
            }
          } else {
            if (point.topography.slope >= 30) {
              priority[3] = { factor: "topography", url: "" };
              priority[4] = { factor: "soil moisture", url: "" };
            }
          }
        }

        console.log(priority);

        score +=
          Math.max(
            4 -
              priority.findIndex(
                (p) => p.factor === "type and density of vegetation"
              ),
            1
          ) *
          (1 - 0.5 * (point.vegetationDensity + 1));
        score +=
          Math.max(
            4 -
              priority.findIndex(
                (p) => p.factor === "temperature and humidity"
              ),
            1
          ) *
          (point.temperature / 125);
        score +=
          Math.max(
            4 -
              priority.findIndex(
                (p) => p.factor === "temperature and humidity"
              ),
            1
          ) *
          (point.humidity / 100);
        score +=
          Math.max(
            4 -
              priority.findIndex(
                (p) => p.factor === "wind speed and direction"
              ),
            1
          ) *
          ((point.windSpeed * 2.237) / 200);
        score +=
          Math.max(
            4 - priority.findIndex((p) => p.factor === "soil moisture"),
            1
          ) *
          0.7 *
          (1 - point.soilMoisture.surface);
        score +=
          Math.max(
            4 - priority.findIndex((p) => p.factor === "soil moisture"),
            1
          ) *
          0.2 *
          (1 - point.soilMoisture.rootZone);
        score +=
          Math.max(
            4 - priority.findIndex((p) => p.factor === "soil moisture"),
            1
          ) *
          0.1 *
          (1 - point.soilMoisture.profile);
        score +=
          Math.max(
            4 - priority.findIndex((p) => p.factor === "topography"),
            1
          ) *
          ((point.topography.slope || 0) / 100);

        // for (
        //   let i = 0;
        //   i <
        //   (multifactor != true
        //     ? basePriority.length
        //     : multifactorPriority.length);
        //   i++
        // ) {
        //   for (let j = 0; j < priority.length; j++) {
        //     if (
        //       priority[i].factor ===
        //       (multifactor != true
        //         ? basePriority[j].factor
        //         : multifactorPriority[j].factor)
        //     ) {
        //       score += 5 - j - i;
        //     }
        //   }
        // }

        console.log(score);

        return {
          point: { lat: point.point.lat, lon: point.point.lon },
          score,
        };
      });

      const bestPoint = pointScores.reduce((best, current) =>
        current.score > best.score ? current : best
      );

      console.log(bestPoint);

      return {
        bestPoint: bestPoint.point,
        bestScore: bestPoint.score,
      };
    });
  };

  const findOptimalPoint = (clusterScores: ClusterScore[]) => {
    return clusterScores.reduce((best, current) =>
      current.bestScore > best.bestScore ? current : best
    ).bestPoint;
  };

  // const generateReason = () => {
  //   return "placeholder reason";
  // };

  // class FRPPredictionClient {
  //   private apiUrl: string;

  //   constructor(serverIp: string, port: number = 5000) {
  //     this.apiUrl = `http://${serverIp}:${port}/predict`;
  //   }

  //   async generateIntensity(
  //     lat: number,
  //     lon: number
  //   ): Promise<PredictionResult> {
  //     try {
  //       const response = await fetch(this.apiUrl, {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({ lat, lon }),
  //       });

  //       if (!response.ok) {
  //         throw new Error(`HTTP error! Status: ${response.status}`);
  //       }

  //       return await response.json();
  //     } catch (error) {
  //       console.error("FRP prediction failed:", error);
  //       return {
  //         success: false,
  //         error: error instanceof Error ? error.message : String(error),
  //       };
  //     }
  //   }
  // }

  const findEnvironmentalData = async (lat: number, lon: number) => {
    try {
      const start = getFormattedDate(-30);
      const end = getFormattedDate(0);

      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?start=${parseInt(
        start
      )}&end=${parseInt(
        end
      )}&latitude=${lat}&longitude=${lon}&community=RE&parameters=T2M,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN,GWETPROF&format=JSON`;

      console.log("NASA POWER API URL:", url);

      const response = await fetch(url);
      const rawData = await response.text();

      if (!response.ok) {
        console.error(
          "API Error:",
          response.status,
          response.statusText,
          rawData
        );
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = JSON.parse(rawData);

      return processNasaPowerData(data);
    } catch (error) {
      console.error("Error fetching NASA POWER data:", error);
      throw error;
    }
  };

  const getFormattedDate = (daysOffset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");

    return `${year}${month}${day}`;
  };

  const processNasaPowerData = (rawData: NasaPowerTemporalData) => {
    const result = {
      temperature: rawData.properties.parameter.T2M,
      precipitation: rawData.properties.parameter.PRECTOTCORR,
      humidity: rawData.properties.parameter.RH2M,
      solarRadiation: rawData.properties.parameter.ALLSKY_SFC_SW_DWN,
      soilMoisture: rawData.properties.parameter.GWETPROF,
    };

    return result;
  };

  async function generateIntensity(
    lat: number,
    tempData: Record<string, number>,
    precipData: Record<string, number>,
    humidityData: Record<string, number>,
    solarData: Record<string, number>,
    soilData: Record<string, number>
  ): Promise<number> {
    try {
      const temp = getMostRecentValidValue(tempData);
      const precip = getMostRecentValidValue(precipData);
      const humidity = getMostRecentValidValue(humidityData);
      const solar = getMostRecentValidValue(solarData);
      const soil = getMostRecentValidValue(soilData);

      console.log("Extracted data:", {
        lat,
        temp,
        precip,
        humidity,
        solar,
        soil,
      });

      const response = await fetch(
        `${process.env.FLASK_API_URL || "http://localhost:5000"}/predict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify([lat, temp, precip, humidity, solar, soil]),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Unknown prediction error");
      }

      return result.prediction[0];
    } catch (error) {
      console.error("Prediction failed:", error);
      throw error;
    }
  }

  function getMostRecentValidValue(data: Record<string, number>): number {
    const dates = Object.keys(data).sort().reverse();

    for (const date of dates) {
      const value = data[date];
      if (value !== -999 && !isNaN(value)) {
        return value;
      }
    }

    console.warn("No valid data found, using default value");
    return 0;
  }

  try {
    console.log("Reached try block");
    let location = { lat: 0, lon: 0 };
    console.log(location);

    let environmentalData;

    if (minLon && minLat && maxLon && maxLat) {
      environmentalData = await generateGridPoints(
        determineSampleCount(calculateAreaSize(minLon, minLat, maxLon, maxLat)),
        minLon,
        minLat,
        maxLon,
        maxLat
      );
    } else {
      environmentalData = await generateGridPoints(
        determineSampleCount(
          calculateAreaSize(
            undefined,
            undefined,
            undefined,
            undefined,
            coordinates
          )
        ),
        undefined,
        undefined,
        undefined,
        undefined,
        coordinates
      );
    }

    console.log(environmentalData);

    const clusters = findEnvironmentalClusters(environmentalData);
    console.log(clusters);
    const clusterScores = findClusterScores(clusters);
    location = findOptimalPoint(clusterScores);
    console.log(location);

    const locationData = await findEnvironmentalData(
      location.lat,
      location.lon
    );

    // const reason = generateReason();

    // const serverIp = process.env.SERVER_IP || "";

    // const frpClient = new FRPPredictionClient(serverIp);
    // const intensity = await frpClient.generateIntensity(
    //   location.lat,
    //   location.lon
    // );
    const intensity = await generateIntensity(
      location.lat,
      locationData.temperature,
      locationData.precipitation,
      locationData.humidity,
      locationData.solarRadiation,
      locationData.soilMoisture
    );

    return NextResponse.json(
      {
        locationName: environmentalData[0].location,
        location,
        intensity,
        status: 200,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "https://hydraapp.vercel.app",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({
      error: "Error fetching optimal controlled fire location.",
      status: 500,
    });
  }
}
