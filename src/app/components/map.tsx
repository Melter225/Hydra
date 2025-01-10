"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const geoUrl =
  "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

const Map = () => {
  const [fireType, setFireType] = useState<string>("Wildfire");
  const [description, setDescription] = useState<string>(
    "A wildfire, wildland fire or rural fire is an uncontrolled fire in an area of combustible vegetation occurring in rural areas."
  );
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const toggleFireType = () => {
    setFireType((prevType) =>
      prevType === "Wildfire" ? "Controlled Fire" : "Wildfire"
    );
    setDescription((prevType) =>
      prevType ===
      "A wildfire, wildland fire or rural fire is an uncontrolled fire in an area of combustible vegetation occurring in rural areas."
        ? "Controlled fires are fires that are intentionally ignited for forest management, agricultural, or other purposes. They are both a tool and a weapon for forest management."
        : "A wildfire, wildland fire or rural fire is an uncontrolled fire in an area of combustible vegetation occurring in rural areas."
    );
  };

  return (
    <section id="map">
      <div className="my-20 px-6 sm:px-12 lg:px-24">
        <div className="w-full border-2 border-gray-800 rounded-t-md p-5 flex justify-between items-center">
          <div>
            <p className="text-xl font-semibold">Current Mode: {fireType}</p>
            <p className="text-sm text-gray-400 mt-1 pr-[3rem]">
              {description}
            </p>
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 border-2 border-indigo-400 text-gray-300 hover:text-gray-300 rounded-lg"
            onClick={toggleFireType}
            variant="outline"
          >
            Toggle Mode
          </Button>
        </div>
        <div className="border-x-2 border-b-2 border-gray-800 rounded-b-md p-5">
          <ComposableMap>
            <ZoomableGroup zoom={1}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => {
                        setSelectedCountry(geo.properties.name);
                      }}
                      style={{
                        default: {
                          fill: "#D6D6DA",
                          outline: "none",
                        },
                        hover: {
                          fill: "#F53",
                          outline: "none",
                        },
                        pressed: {
                          fill: "#E42",
                          outline: "none",
                        },
                      }}
                    />
                  ))
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
          {selectedCountry && (
            <p className="mt-4 text-center">
              Selected Country: {selectedCountry} - Fire Type: {fireType}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default Map;
