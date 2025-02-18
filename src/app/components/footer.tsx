import React from "react";

const Footer = () => {
  return (
    <footer>
      <div className="flex items-center absolute w-full bg-gradient-to-t from-[#7a383a] to-transparent pl-6 py-7">
        <p>&copy; {new Date().getFullYear()} Inferno. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
