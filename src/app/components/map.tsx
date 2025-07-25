"use client";

import React, { useState, useRef } from "react";
import { GoogleMap, LoadScript, Polygon, Marker } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SearchBounds {
  coordinates: { lat: number; lng: number }[];
}

interface OptimalLocation {
  coordinates: [number, number];
  name: string;
}

interface CoordinateError {
  minLat?: string;
  maxLat?: string;
  minLon?: string;
  maxLon?: string;
}

type controlledFireData = {
  location: {
    lon: number;
    lat: number;
  };
  locationName: string;
  intensity: number;
};

type ControlledFireData = controlledFireData | null;

const Map = () => {
  const fireType = "Controlled Fire";
  const description =
    "Controlled fires are fires that are intentionally ignited for forest management, agricultural, or other purposes. They are both a tool and a weapon for forest management.";
  const [showModal, setShowModal] = useState(true);
  const [minLat, setMinLat] = useState("");
  const [maxLat, setMaxLat] = useState("");
  const [minLon, setMinLon] = useState("");
  const [maxLon, setMaxLon] = useState("");
  const [minLatDirection, setMinLatDirection] = useState("N");
  const [maxLatDirection, setMaxLatDirection] = useState("N");
  const [minLonDirection, setMinLonDirection] = useState("E");
  const [maxLonDirection, setMaxLonDirection] = useState("E");
  const [coordinateErrors, setCoordinateErrors] = useState<CoordinateError>({});
  const [inputError, setInputError] = useState("");
  const [controlledFireData, setControlledFireData] =
    useState<ControlledFireData>(null);
  const [optimalLocation, setOptimalLocation] =
    useState<OptimalLocation | null>(null);
  const [selectedBounds, setSelectedBounds] = useState<SearchBounds | null>(
    null
  );
  const [zoom, setZoom] = useState(3);
  const [mapCenter, setMapCenter] = useState({ lat: 0, lng: 0 });
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isMapLoaded2, setIsMapLoaded2] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [clickedMarkers, setClickedMarkers] = useState<SearchBounds>({
    coordinates: [],
  });

  const mapRef = useRef<google.maps.Map | null>(null);

  const containerStyle = {
    width: "100%",
    height: "70svh",
  };

  const validateCoordinates = () => {
    const errors: CoordinateError = {};
    let isValid = true;

    const minLatNum = parseFloat(minLat);
    const maxLatNum = parseFloat(maxLat);

    if (!minLatNum || isNaN(minLatNum)) {
      errors.minLat = "Please enter a valid minimum latitude";
      isValid = false;
    } else if (minLatNum < 0 || minLatNum > 90) {
      errors.minLat = "Latitude must be between 0 and 90 degrees";
      isValid = false;
    }

    if (!maxLatNum || isNaN(maxLatNum)) {
      errors.maxLat = "Please enter a valid maximum latitude";
      isValid = false;
    } else if (maxLatNum < 0 || maxLatNum > 90) {
      errors.maxLat = "Latitude must be between 0 and 90 degrees";
      isValid = false;
    }

    const minLonNum = parseFloat(minLon);
    const maxLonNum = parseFloat(maxLon);

    if (!minLonNum || isNaN(minLonNum)) {
      errors.minLon = "Please enter a valid minimum longitude";
      isValid = false;
    } else if (minLonNum < 0 || minLonNum > 180) {
      errors.minLon = "Longitude must be between 0 and 180 degrees";
      isValid = false;
    }

    if (!maxLonNum || isNaN(maxLonNum)) {
      errors.maxLon = "Please enter a valid maximum longitude";
      isValid = false;
    } else if (maxLonNum < 0 || maxLonNum > 180) {
      errors.maxLon = "Longitude must be between 0 and 180 degrees";
      isValid = false;
    }

    setCoordinateErrors(errors);

    return isValid;
  };

  // const toggleFireType = () => {
  //   setShowModal(true);
  // };

  const handleSubmit = async () => {
    if (!showMap && !validateCoordinates()) {
      return;
    }

    try {
      let polygonCoordinates: { lat: number; lng: number }[] = [];
      let signedMinLat = null;
      let signedMaxLat = null;
      let signedMinLon = null;
      let signedMaxLon = null;

      if (clickedMarkers.coordinates.length > 0) {
        polygonCoordinates = [...clickedMarkers.coordinates];
      } else {
        signedMinLat =
          minLatDirection === "S" ? -parseFloat(minLat) : parseFloat(minLat);
        signedMaxLat =
          maxLatDirection === "S" ? -parseFloat(maxLat) : parseFloat(maxLat);
        signedMinLon =
          minLonDirection === "W" ? -parseFloat(minLon) : parseFloat(minLon);
        signedMaxLon =
          maxLonDirection === "W" ? -parseFloat(maxLon) : parseFloat(maxLon);

        polygonCoordinates = [
          { lat: signedMinLat, lng: signedMinLon },
          { lat: signedMaxLat, lng: signedMinLon },
          { lat: signedMaxLat, lng: signedMaxLon },
          { lat: signedMinLat, lng: signedMaxLon },
        ];
      }

      console.log("Coordinates parsed");

      setSelectedBounds({
        coordinates: polygonCoordinates,
      });

      console.log("isLoading set to true");
      setIsLoading(true);

      console.log("Bounding box", selectedBounds, polygonCoordinates, [
        ...clickedMarkers.coordinates,
      ]);

      const response = await fetch(
        `${process.env.BACKEND_API_URL}/api/controlledFire`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minLat: signedMinLat,
            maxLat: signedMaxLat,
            minLon: signedMinLon,
            maxLon: signedMaxLon,
            coordinates:
              clickedMarkers.coordinates.length > 0
                ? clickedMarkers.coordinates
                : null,
          }),
        }
      );

      const data = await response.json();
      console.log("data", data, "location", {
        coordinates: [data.location.lat, data.location.lon],
        name: data.locationName || "Optimal Location",
      });
      setControlledFireData(data);
      setOptimalLocation({
        coordinates: [data.location.lon, data.location.lat],
        name: data.locationName || "Optimal Location",
      });
      console.log(controlledFireData, optimalLocation);
      setMapCenter({ lat: data.location.lat, lng: data.location.lon });
      setZoom(8);
      setShowModal(false);

      console.log("isLoading set to false");
      setIsLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setCoordinateErrors({});
      setInputError("Failed to process request. Please try again.");
      setIsLoading(false);
    }
  };

  const downloadMapImage = async () => {
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${
      mapCenter.lat
    },${mapCenter.lng}&zoom=${zoom}&size=600x400&maptype=roadmap&marker=${
      optimalLocation
        ? `&markers=color:red%7Clabel:O%7C${optimalLocation.coordinates[1]},${optimalLocation.coordinates[0]}`
        : ""
    }&path=${
      selectedBounds
        ? `&path=fillcolor:0xFF000033|color:0xFF000080|weight:2${selectedBounds.coordinates
            .map((coord) => `|${coord.lat},${coord.lng}`)
            .join("")}`
        : ""
    }&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    console.log("imageUrl", imageUrl);

    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "map.png";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="map" className="mt-0 xs:mt-40">
      <h1 className="px-6 sm:px-12 lg:px-24 text-3xl mt-[3.75rem] sm:text-4xl font-bold">
        Map
      </h1>
      <div className="mt-6 mb-24 px-6 sm:px-12 lg:px-24">
        <div className="w-full border-2 border-gray-800 rounded-t-md p-5 flex flex-col sm:flex-row gap-y-4 sm:gap-y-0 justify-between items-start sm:items-center">
          <div>
            <p className="text-xl font-semibold mr-4 md:mr-0">{fireType}</p>
            <p className="hidden sm:block text-sm text-gray-700 mt-1 pr-[3rem]">
              {description}
            </p>
          </div>
          <div className="flex xs:flex-col sm:flex-col gap-x-4 xs:gap-y-3 sm:gap-x-0 sm:gap-y-3 items-center">
            <Button
              className="bg-blue-600 hover:bg-blue-700 border-2 border-blue-400 text-gray-300 hover:text-gray-300 rounded-lg"
              onClick={() => setShowModal(true)}
              variant="outline"
            >
              Enter Coordinates
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 border-2 border-blue-400 text-gray-300 hover:text-gray-300 rounded-lg"
              onClick={downloadMapImage}
              variant="outline"
            >
              Download Map
            </Button>
            {/* <Button
              className="bg-blue-600 hover:bg-blue-700 border-2 border-blue-400 text-gray-300 hover:text-gray-300 w-full rounded-lg"
              onClick={toggleFireType}
              variant="outline"
            >
              Toggle Mode
            </Button> */}
          </div>
        </div>

        <div
          className={`map ${
            isMapLoaded === false ? "hidden" : "block"
          } border-x-2 border-b-2 border-gray-800 rounded-b-md p-4 relative`}
        >
          <div className="w-full h-full overflow-hidden rounded-md">
            <LoadScript
              googleMapsApiKey={
                process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
              }
              onLoad={() => setIsMapLoaded(true)}
            >
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={mapCenter}
                zoom={zoom}
                onLoad={(map) => {
                  mapRef.current = map;
                }}
                onIdle={() => {
                  if (mapRef.current) {
                    const center = mapRef.current.getCenter();
                    setMapCenter({
                      lat: center?.lat() || 0,
                      lng: center?.lng() || 0,
                    });
                    setZoom(mapRef.current.getZoom() || 0);
                  }
                }}
              >
                {selectedBounds &&
                  (console.log(
                    "Rendering polygon with:",
                    selectedBounds?.coordinates
                  ),
                  (
                    <Polygon
                      paths={selectedBounds.coordinates}
                      options={{
                        strokeColor: "#FF0000",
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: "#FF0000",
                        fillOpacity: 0.15,
                      }}
                    />
                  ))}

                {optimalLocation && (
                  <Marker
                    position={{
                      lat: optimalLocation.coordinates[1],
                      lng: optimalLocation.coordinates[0],
                    }}
                    icon={{
                      path: "M11.7 4.25C11.2858 4.24999 10.95 4.58577 10.95 4.99998C10.95 5.4142 11.2858 5.74999 11.7 5.75L11.7 4.25ZM13.5652 5.376L13.8555 4.68446L13.8552 4.68435L13.5652 5.376ZM15.7531 7.2L15.1268 7.61262L15.1272 7.6133L15.7531 7.2ZM16.575 9.94L17.325 9.94L17.325 9.93883L16.575 9.94ZM15.1466 13.433L14.536 12.9976C14.5271 13.01 14.5186 13.0228 14.5105 13.0357L15.1466 13.433ZM13.7309 15.7L13.0948 15.3027L13.0922 15.3069L13.7309 15.7ZM11.7 19L11.0617 19.3937C11.1983 19.6153 11.4401 19.7501 11.7004 19.75C11.9607 19.7499 12.2023 19.6148 12.3387 19.3931L11.7 19ZM9.66909 15.707L10.3075 15.3133L10.3055 15.3102L9.66909 15.707ZM8.25339 13.436L8.88985 13.0392C8.88178 13.0263 8.87332 13.0136 8.86447 13.0012L8.25339 13.436ZM6.82501 9.943L6.07501 9.94227V9.943H6.82501ZM7.64694 7.2L8.27278 7.6133L8.27282 7.61324L7.64694 7.2ZM9.83484 5.379L10.1247 6.07072L10.126 6.07018L9.83484 5.379ZM11.7011 5.75C12.1154 5.74937 12.4506 5.41308 12.45 4.99887C12.4494 4.58465 12.1131 4.24938 11.6989 4.25L11.7011 5.75ZM11.7 10.837C11.2858 10.837 10.95 11.1728 10.95 11.587C10.95 12.0012 11.2858 12.337 11.7 12.337V10.837ZM11.7 7.543C11.2858 7.543 10.95 7.87879 10.95 8.293C10.95 8.70721 11.2858 9.043 11.7 9.043L11.7 7.543ZM11.719 12.3428C12.133 12.3323 12.4602 11.9881 12.4498 11.574C12.4393 11.16 12.0951 10.8328 11.6811 10.8432L11.719 12.3428ZM10.2764 10.7817L10.927 10.4085L10.927 10.4085L10.2764 10.7817ZM10.2764 9.11131L9.62584 8.73812L9.62584 8.73812L10.2764 9.11131ZM11.6811 9.04976C12.0951 9.06023 12.4393 8.73303 12.4498 8.31895C12.4602 7.90487 12.133 7.56071 11.719 7.55024L11.6811 9.04976ZM11.7 5.75C12.2396 5.75001 12.7746 5.85774 13.2751 6.06765L13.8552 4.68435C13.1717 4.39771 12.4396 4.25002 11.7 4.25L11.7 5.75ZM13.2749 6.06754C14.0246 6.38224 14.6697 6.91882 15.1268 7.61262L16.3794 6.78738C15.761 5.84877 14.8836 5.11602 13.8555 4.68446L13.2749 6.06754ZM15.1272 7.6133C15.58 8.29886 15.8237 9.10956 15.825 9.94117L17.325 9.93883C17.3233 8.81655 16.9945 7.71889 16.3789 6.7867L15.1272 7.6133ZM15.825 9.94C15.825 10.5044 15.7399 10.9165 15.5556 11.3427C15.3608 11.7931 15.0461 12.2822 14.536 12.9976L15.7573 13.8684C16.269 13.1508 16.6684 12.5484 16.9324 11.9381C17.2068 11.3035 17.325 10.6856 17.325 9.94H15.825ZM14.5105 13.0357L13.0948 15.3027L14.3671 16.0973L15.7828 13.8303L14.5105 13.0357ZM13.0922 15.3069L11.0613 18.6069L12.3387 19.3931L14.3697 16.0931L13.0922 15.3069ZM12.3384 18.6063L10.3074 15.3133L9.03073 16.1007L11.0617 19.3937L12.3384 18.6063ZM10.3055 15.3102L8.88985 13.0392L7.61693 13.8328L9.03263 16.1038L10.3055 15.3102ZM8.86447 13.0012C8.35405 12.2838 8.03922 11.7947 7.84433 11.3444C7.66008 10.9186 7.57501 10.5073 7.57501 9.943H6.07501C6.07501 10.6887 6.19324 11.3059 6.46772 11.9401C6.73157 12.5498 7.13093 13.1522 7.6423 13.8708L8.86447 13.0012ZM7.57501 9.94373C7.57582 9.11123 7.81958 8.29958 8.27278 7.6133L7.02109 6.7867C6.40485 7.71986 6.0761 8.81882 6.07501 9.94227L7.57501 9.94373ZM8.27282 7.61324C8.73027 6.92039 9.37536 6.38473 10.1247 6.07072L9.54497 4.68728C8.51733 5.11791 7.63993 5.84942 7.02105 6.78676L8.27282 7.61324ZM10.126 6.07018C10.6264 5.8594 11.1613 5.75081 11.7011 5.75L11.6989 4.25C10.9591 4.25112 10.227 4.39999 9.54369 4.68782L10.126 6.07018ZM11.7 12.337C12.551 12.337 13.3277 11.8714 13.7443 11.1314L12.4371 10.3956C12.28 10.6748 11.9964 10.837 11.7 10.837V12.337ZM13.7443 11.1314C14.1597 10.3934 14.1597 9.4866 13.7443 8.7486L12.4371 9.4844C12.5954 9.76557 12.5954 10.1144 12.4371 10.3956L13.7443 11.1314ZM13.7443 8.7486C13.3277 8.00864 12.551 7.543 11.7 7.543L11.7 9.043C11.9964 9.043 12.28 9.2052 12.4371 9.4844L13.7443 8.7486ZM11.6811 10.8432C11.38 10.8508 11.0889 10.6908 10.927 10.4085L9.62584 11.1549C10.0553 11.9036 10.8541 12.3646 11.719 12.3428L11.6811 10.8432ZM10.927 10.4085C10.7638 10.1241 10.7638 9.76886 10.927 9.4845L9.62584 8.73812C9.19755 9.48474 9.19755 10.4083 9.62584 11.1549L10.927 10.4085ZM10.927 9.4845C11.0889 9.20225 11.38 9.04215 11.6811 9.04976L11.719 7.55024C10.8541 7.52838 10.0553 7.9894 9.62584 8.73812L10.927 9.4845Z",
                      fillColor: "#FF5533",
                      fillOpacity: 1,
                      strokeWeight: 0.4,
                      strokeColor: "#FF5533",
                      scale: 1.5,
                      anchor: new google.maps.Point(12, 12),
                    }}
                  ></Marker>
                )}
              </GoogleMap>
            </LoadScript>
          </div>
          <div
            className={`absolute ${
              controlledFireData ? "bottom-[10.495rem]" : "bottom-7"
            } left-[1.85rem] bg-white p-3 border rounded-md shadow-md`}
          >
            <div className="flex items-center mb-2">
              <div className="w-4 h-4 mr-2 bg-red-300 opacity-50"></div>
              <span className="text-xs">Search Bounds</span>
            </div>
            {fireType === "Controlled Fire" && (
              <div className="flex items-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FF5533"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z" />
                </svg>
                <span className="text-xs ml-2">Optimal Location</span>
              </div>
            )}
          </div>
          {controlledFireData &&
            (console.log(
              "controlledFireData",
              controlledFireData,
              "optimalLocation",
              controlledFireData.location.lon
            ),
            (
              <div className="mt-4 text-center bg-gray-100 p-3 rounded-md">
                <h3 className="font-semibold">Controlled Fire Details</h3>
                <p>Search Bounds: {controlledFireData.locationName}</p>
                <p>
                  Optimal Location: {controlledFireData.location.lat.toFixed(4)}
                  °, {controlledFireData.location.lon.toFixed(4)}°
                </p>
                <p>
                  Approximate Intensity (FRP):{" "}
                  {controlledFireData.intensity.toFixed(2)} megawatts
                </p>
              </div>
            ))}
        </div>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="rounded-md max-w-md sm:max-w-lg">
            {!isLoading && !showMap ? (
              <>
                <DialogHeader className="xs:text-center text-left">
                  <DialogTitle>Enter Coordinates</DialogTitle>
                  <p
                    className="text-[0.92rem] font-medium text-muted-foreground hover:underline hover:cursor-pointer"
                    onClick={() => {
                      setShowMap(true);
                    }}
                  >
                    Or choose from map
                  </p>
                  <DialogDescription>
                    Please enter the minimum and maximum latitude and longitude
                    coordinates the optimal controlled fire location should be
                    found within.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <label htmlFor="minLatitude">
                    Minimum Latitude (0° to 90°)
                  </label>
                  <div className="grid grid-cols-1">
                    <div className="flex gap-2">
                      <Input
                        id="minLatitude"
                        className={`${
                          coordinateErrors.minLat
                            ? "border-[1.5px] border-red-500"
                            : ""
                        }`}
                        type="number"
                        step="any"
                        min="0"
                        max="90"
                        value={minLat}
                        onChange={(e) => setMinLat(e.target.value)}
                        placeholder="Enter minimum latitude"
                      />
                      <Select
                        value={minLatDirection}
                        onValueChange={setMinLatDirection}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            className="hover:cursor-pointer"
                            value="N"
                          >
                            N
                          </SelectItem>
                          <SelectItem
                            className="hover:cursor-pointer"
                            value="S"
                          >
                            S
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {coordinateErrors.minLat && (
                      <p className="text-sm text-red-500">
                        {coordinateErrors.minLat}
                      </p>
                    )}
                  </div>

                  <label htmlFor="maxLatitude">
                    Maximum Latitude (0° to 90°)
                  </label>
                  <div className="grid grid-cols-1">
                    <div className="flex gap-2">
                      <Input
                        id="maxLatitude"
                        className={`${
                          coordinateErrors.maxLat
                            ? "border-[1.5px] border-red-500"
                            : ""
                        }`}
                        type="number"
                        step="any"
                        min="0"
                        max="90"
                        value={maxLat}
                        onChange={(e) => setMaxLat(e.target.value)}
                        placeholder="Enter maximum latitude"
                      />
                      <Select
                        value={maxLatDirection}
                        onValueChange={setMaxLatDirection}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            className="hover:cursor-pointer"
                            value="N"
                          >
                            N
                          </SelectItem>
                          <SelectItem
                            className="hover:cursor-pointer"
                            value="S"
                          >
                            S
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {coordinateErrors.maxLat && (
                      <p className="text-sm text-red-500">
                        {coordinateErrors.maxLat}
                      </p>
                    )}
                  </div>

                  <label htmlFor="minLongitude">
                    Minimum Longitude (0° to 180°)
                  </label>
                  <div className="grid grid-cols-1">
                    <div className="flex gap-2">
                      <Input
                        id="minLongitude"
                        className={`${
                          coordinateErrors.minLon
                            ? "border-[1.5px] border-red-500"
                            : ""
                        }`}
                        type="number"
                        step="any"
                        min="0"
                        max="180"
                        value={minLon}
                        onChange={(e) => setMinLon(e.target.value)}
                        placeholder="Enter minimum longitude"
                      />
                      <Select
                        value={minLonDirection}
                        onValueChange={setMinLonDirection}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            className="hover:cursor-pointer"
                            value="E"
                          >
                            E
                          </SelectItem>
                          <SelectItem
                            className="hover:cursor-pointer"
                            value="W"
                          >
                            W
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {coordinateErrors.minLon && (
                      <p className="text-sm text-red-500">
                        {coordinateErrors.minLon}
                      </p>
                    )}
                  </div>

                  <label htmlFor="maxLongitude">
                    Maximum Longitude (0° to 180°)
                  </label>
                  <div className="grid grid-cols-1">
                    <div className="flex gap-2">
                      <Input
                        id="maxLongitude"
                        className={`${
                          coordinateErrors.maxLon
                            ? "border-[1.5px] border-red-500"
                            : ""
                        }`}
                        type="number"
                        step="any"
                        min="0"
                        max="180"
                        value={maxLon}
                        onChange={(e) => setMaxLon(e.target.value)}
                        placeholder="Enter maximum longitude"
                      />
                      <Select
                        value={maxLonDirection}
                        onValueChange={setMaxLonDirection}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            className="hover:cursor-pointer"
                            value="E"
                          >
                            E
                          </SelectItem>
                          <SelectItem
                            className="hover:cursor-pointer"
                            value="W"
                          >
                            W
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {coordinateErrors.maxLon && (
                      <p className="text-sm text-red-500">
                        {coordinateErrors.maxLon}
                      </p>
                    )}
                  </div>

                  {inputError && (
                    <p className="text-sm text-red-500">{inputError}</p>
                  )}
                </div>
                <DialogFooter className="gap-y-3">
                  <Button variant="outline" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={isLoading}>
                    Submit
                  </Button>
                </DialogFooter>
              </>
            ) : !isLoading && showMap ? (
              <>
                <DialogHeader className="xs:text-center text-left">
                  <DialogTitle>Choose from Map</DialogTitle>
                  <p
                    className="text-[0.92rem] font-medium text-muted-foreground hover:underline hover:cursor-pointer"
                    onClick={() => {
                      setShowMap(false);
                    }}
                  >
                    Or enter coordinates
                  </p>
                  <DialogDescription>
                    Please select the minimum and maximum latitude and longitude
                    coordinates the optimal controlled fire location should be
                    found within.
                  </DialogDescription>
                </DialogHeader>
                <div
                  className={`rounded-md overflow-hidden ${
                    isMapLoaded2 ? "block" : "hidden"
                  }`}
                >
                  {/* <LoadScript
                    googleMapsApiKey={
                      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
                    }
                    onLoad={() => setIsMapLoaded(true)}
                  > */}
                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={mapCenter}
                    zoom={zoom}
                    onLoad={() => setIsMapLoaded2(true)}
                    onClick={(e) => {
                      if (e.latLng) {
                        const lat = e.latLng.lat();
                        const lng = e.latLng.lng();
                        console.log("map clicked at:", { lat, lng });
                        setClickedMarkers((prev) => {
                          if (prev.coordinates.length < 4) {
                            return {
                              coordinates: [...prev.coordinates, { lat, lng }],
                            };
                          } else {
                            return {
                              coordinates: [
                                ...prev.coordinates.slice(0, -1),
                                { lat, lng },
                              ],
                            };
                          }
                        });
                      }
                    }}
                  >
                    {clickedMarkers.coordinates.map((marker, index) => (
                      <Marker
                        key={index}
                        position={{ lat: marker.lat, lng: marker.lng }}
                        draggable={true}
                        onDragEnd={(e) => {
                          if (e.latLng) {
                            const lat = e.latLng.lat();
                            const lng = e.latLng.lng();
                            console.log("marker dragged to:", { lat, lng });
                            setClickedMarkers((prev) => {
                              if (prev.coordinates.length < 4) {
                                return {
                                  coordinates: [
                                    ...prev.coordinates,
                                    { lat, lng },
                                  ],
                                };
                              } else {
                                return {
                                  coordinates: [
                                    ...prev.coordinates.slice(0, -1),
                                    { lat, lng },
                                  ],
                                };
                              }
                            });
                          }
                        }}
                        icon={{
                          url: "data:image/svg+xml;charset=UTF-8,%3csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='10' cy='10' r='8' fill='%23FF0000' stroke='%23FFFFFF' stroke-width='2'/%3e%3c/svg%3e",
                        }}
                      />
                    ))}

                    {clickedMarkers.coordinates.length > 3 && (
                      <Polygon
                        paths={clickedMarkers.coordinates}
                        options={{
                          strokeColor: "#FF0000",
                          strokeOpacity: 0.8,
                          strokeWeight: 2,
                          fillColor: "#FF0000",
                          fillOpacity: 0.15,
                        }}
                      />
                    )}
                  </GoogleMap>
                  {/* </LoadScript> */}
                </div>
                <DialogFooter className="gap-y-3">
                  <Button variant="outline" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={isLoading}>
                    Submit
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="flex flex-col items-center py-8">
                <div
                  className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-400 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                  role="status"
                >
                  <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                    Loading...
                  </span>
                </div>
                <p className="mt-4 text-gray-600">
                  Identifying optimal location, please wait...
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default Map;
