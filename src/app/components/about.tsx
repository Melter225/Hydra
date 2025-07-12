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
              and human communities, and, while controlled burns mitigate risks
              and promote ecological health effectively, identifying the best
              locations for these burns remains a complex task. Hydra leverages
              historical data and cutting-edge predictive models to empower
              forest managers and even common citizens with accurate,
              data-driven recommendations for controlled burns. Inspired by
              research like that of Coffield et al. (2022), which highlights the
              potential of machine learning to enhance wildfire prediction, our
              app integrates several environmental variables such as type and
              density of vegetation, soil moisture, wind speed and direction,
              temperature and humidity, topography into an intuitive platform.
              Not only does Hydra offer optimal locations on where to start a
              controlled burn, it additionally provides a map displaying the
              risk of wildfires globally. We created Hydra due to its
              originality in the world of science as well as its utility as a
              beneficial product.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
