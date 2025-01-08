import React from "react";

const Header = () => {
  return (
    <header className="flex bg-red-500/40 backdrop-blur-md items-center justify-center p-4 h-20">
      <div className="flex justify-center">
        <h1 className="text-2xl font-bold">My App Header</h1>
      </div>
    </header>
  );
};

export default Header;
