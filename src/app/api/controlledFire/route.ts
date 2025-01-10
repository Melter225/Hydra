import { NextRequest, NextResponse } from "next/server";
import fetch from "node-fetch";

export async function POST(req: NextRequest) {
  const { lat, lon } = await req.json();

  try {
    const vegetationResponse = await fetch(
      `https://earthdata.nasa.gov/api/modis/vegetation?lat=${lat}&lon=${lon}`
    );
    const vegetationData = await vegetationResponse.json();

    const soilResponse = await fetch(
      `https://earthdata.nasa.gov/api/smap/soil-moisture?lat=${lat}&lon=${lon}`
    );
    const soilData = await soilResponse.json();

    const windResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}`
    );
    const windData = await windResponse.json();
    const wind = windData.wind;

    const temperatureResponse = await fetch(
      `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${lat},${lon}`
    );
    const temperatureData = await temperatureResponse.json();
    const temperature = temperatureData.current.temperature;
    const humidity = temperatureData.current.humidity;

    const topographyResponse = await fetch(
      `https://nationalmap.gov/epqs/pqs.php?x=${lon}&y=${lat}&units=Meters&output=json`
    );

    const topographyData = await topographyResponse.json();

    return NextResponse.json({
      vegetationData,
      soilData,
      wind,
      temperature,
      humidity,
      topographyData,
      status: 200,
    });
  } catch {
    return NextResponse.json({
      error:
        "Error fetching vegetation, soil moisture, wind, temperature, or topography data",
      status: 500,
    });
  }
}
