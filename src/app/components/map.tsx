import React from "react";

const Map = () => {
  const rows = 10;
  const cols = 10;
  const filler = Array(rows).fill(Array(cols).fill(""));

  return (
    <div className="grid grid-cols-10 gap-0 mt-12 px-6 sm:px-12 lg:px-24">
      {filler.map((row, rowIndex) =>
        row.map((colIndex: number) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className="border border-gray-800 p-2 text-center"
          >
            {`${rowIndex},${colIndex}`}
          </div>
        ))
      )}
    </div>
  );
};

export default Map;
