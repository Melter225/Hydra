"use client";

import Image from "next/image";
import React from "react";

const Header = () => {
  const scrollToSection = (section: string) => {
    const element = document.getElementById(section) as HTMLElement;
    element.style.scrollMarginTop = "7rem";
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="fixed flex z-50 bg-[#964448]/60 backdrop-blur-md items-center justify-between top-0 p-4 w-full h-20">
      <div className="flex items-center">
        <Image
          className="ml-5 mr-4"
          src="/logo.png"
          alt="Logo"
          width={27}
          height={27}
        />
        <h1 className="text-2xl font-bold">Inferno</h1>
      </div>
      <div className="hidden sm:flex sm:items-center md:justify-normal">
        <div className="hidden sm:flex absolute sm:left-[82%] md:left-1/2 sm:transform sm:-translate-x-1/2">
          <div className="grid grid-cols-2 items-center justify-center w-[12rem] rounded-full border-2 border-neutral-800 py-2 px-2">
            <p
              className="text-center hover:cursor-pointer"
              onClick={() => {
                scrollToSection("about");
              }}
            >
              About
            </p>
            <p
              className="text-center hover:cursor-pointer"
              onClick={() => {
                scrollToSection("map");
              }}
            >
              Map
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
