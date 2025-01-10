"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const geoUrl =
  "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

const Map = () => {
  const [fireType, setFireType] = useState("Wildfire");
  const [description, setDescription] = useState(
    "A wildfire, wildland fire or rural fire is an uncontrolled fire in an area of combustible vegetation occurring in rural areas."
  );
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [inputError, setInputError] = useState<string>("");

  const validateCoordinates = () => {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (!lat || isNaN(latNum)) {
      setInputError("Please enter a valid latitude");
      return false;
    }

    if (!lon || isNaN(lonNum)) {
      setInputError("Please enter a valid longitude");
      return false;
    }

    if (latNum < -90 || latNum > 90) {
      setInputError("Latitude must be between -90 and 90 degrees");
      return false;
    }

    if (lonNum < -180 || lonNum > 180) {
      setInputError("Longitude must be between -180 and 180 degrees");
      return false;
    }

    setInputError("");
    return true;
  };

  const toggleFireType = () => {
    if (fireType === "Wildfire") {
      setShowModal(true);
    } else {
      handleFireTypeChange("Wildfire");
    }
  };

  const handleFireTypeChange = (newType: string) => {
    setFireType(newType);
    setDescription(
      newType === "Controlled Fire"
        ? "Controlled fires are fires that are intentionally ignited for forest management, agricultural, or other purposes. They are both a tool and a weapon for forest management."
        : "A wildfire, wildland fire or rural fire is an uncontrolled fire in an area of combustible vegetation occurring in rural areas."
    );
  };

  const handleSubmit = async () => {
    if (validateCoordinates()) {
      try {
        const response = await fetch("/api/controlledFire", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lat: parseFloat(lat), lon: parseFloat(lon) }),
        });
        const data = await response.json();
        console.log("Data:", data);
        handleFireTypeChange("Controlled Fire");
        setShowModal(false);
      } catch (error) {
        console.error("Error:", error);
        setInputError("Failed to process request. Please try again.");
      }
    }
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

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter Coordinates</DialogTitle>
              <DialogDescription>
                Please enter the latitude and longitude coordinates the optimal
                controlled fire location should be found within.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="latitude">Latitude (-90 to 90)</label>
                <Input
                  id="latitude"
                  className={`${
                    inputError.includes("latitude") ||
                    inputError.includes("Latitude") ||
                    inputError === "Please enter valid coordinates"
                      ? "border-[1.5px] border-red-500"
                      : ""
                  }`}
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="Enter latitude"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="longitude">Longitude (-180 to 180)</label>
                <Input
                  id="longitude"
                  className={`${
                    inputError.includes("longitude") ||
                    inputError.includes("Longitude") ||
                    inputError === "Please enter valid coordinates"
                      ? "border-[1.5px] border-red-500"
                      : ""
                  }`}
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="Enter longitude"
                />
              </div>
              {inputError && (
                <p className="text-sm text-red-500">{inputError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default Map;
