"use client";

import React, { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

const Popup = () => {
  const [showPopup, setShowPopup] = React.useState(true);

  useEffect(() => {
    if (showPopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showPopup]);

  if (!showPopup) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => setShowPopup(false)}
      />

      <div className="relative bg-gray-50 rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200 border border-gray-100">
        <button
          onClick={() => setShowPopup(false)}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 group"
          aria-label="Close popup"
        >
          <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
        </button>

        <div className="p-8">
          <div className="flex items-start mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mr-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                Processing Time Notice
              </h2>
              <p className="text-sm text-gray-500">
                Important information about Hydra testing
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              When testing Hydra, please note that{" "}
              <span className="font-semibold text-gray-900">
                larger areas of land will take longer to process
              </span>
              , even up to 3 or 4 minutes.
            </p>

            <p className="text-gray-700 leading-relaxed">
              Keep in mind that as long as you see the loading indicator, the
              process is still ongoing, and{" "}
              <span className="font-semibold text-gray-900">
                Hydra will notify you if it encounters an issue
              </span>
              .
            </p>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setShowPopup(false)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-gray-200 font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Popup;
