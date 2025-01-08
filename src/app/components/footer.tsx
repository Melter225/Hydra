import React from "react";
// import "./footer.css";

const Footer = () => {
  return (
    <footer className="absolute w-full bottom-0 bg-gradient-to-b from-transparent to-[#6d3435] p-4 pt-12">
      <div>
        <p>&copy; {new Date().getFullYear()} Inferno. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
