import React from "react";

const Footer = () => {
  return (
    <footer>
      <div className="flex items-center absolute w-full bg-gradient-to-t from-[#5e92b7] to-transparent pl-6 pt-16 pb-6">
        <p>&copy; {new Date().getFullYear()} Hydra. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
