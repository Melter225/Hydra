"use client";

const About = () => {
  return (
    <section id="about" className="block xs:hidden mt-40 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[#4f91c0] to-transparent mt-[5.5rem]"></div>
      <div className="z-10 absolute inset-0">
        <div
          className="w-full h-[70%] mt-[5.5rem]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #4b8ab8 1.4px, transparent 1px),
              linear-gradient(to bottom, #4b8ab8 1.4px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
          }}
        ></div>
      </div>
      <div className="relative z-20">
        <h1 className="px-6 sm:px-12 lg:px-24 text-3xl sm:text-4xl font-bold">
          About
        </h1>
        <div className="relative px-6 sm:px-12 lg:px-24 pb-20 mt-[3.5rem]">
          <div className="relative top-[-1.75rem] bg-[#c3cad6] border-[3px] border-[#75a2c3] px-6 py-4 rounded-lg">
            <p className="text-sm sm:text-base">
              Hydra is an innovative app designed to tackle the challenges
              wildfires pose. These natural disasters threaten both ecosystems
              and human communities, and in 2024 alone, the United States
              experienced 64,897 wildfires, scorching approximately 8.9 million
              acres, resulting in $275 billion of economic losses, the
              destruction of 16,200 structures, and untold human tragedy. While
              controlled burns mitigate risks and promote ecological health
              effectively, reducing the likelihood of a catastrophic wildfire by
              68%, identifying the optimal locations for these controlled burns
              remains a complex task. Inspired by research like that of Coffield
              et al. (2022), which highlights the potential of machine learning
              to enhance wildfire prediction, our app integrates several
              environmental variables such as type and density of vegetation,
              soil moisture, wind speed and direction, temperature and humidity,
              topography with historical data into an intuitive platform that
              provides data-driven recommendations about the optimal location
              for a controlled burn within a given region. Not only does Hydra
              identify the optimal location for a controlled fire, but it also
              predicts its FRP (Fire Radiative Power) as a measure of intensity
              through an ML XGB Boost prediction model, allowing firefighters
              and forestry officials to understand whether a location is
              suitable for a controlled burn or if such a fire would be too
              intense to effectively manage. Furthermore, Hydra is a
              one-of-a-kind tool, unparalleled in the world of wildfire
              management. Hydra ultimately achieved a ~90.3% accuracy in
              identifying the optimal location for a controlled fire and serves
              as an extremely beneficial product.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
