"use client";

const About = () => {
  return (
    <section id="about" className="mt-40 px-6 sm:px-12 lg:px-24">
      <div>
        <h1 className="text-3xl font-bold">About</h1>
        <p className="mt-2">
          Inferno is an innovative app designed to tackle the challenges
          wildfires pose. These natural disasters threaten both ecosystems and
          human communities, and, while controlled burns mitigate risks and
          promote ecological health effectively, identifying the best locations
          for these burns remains a complex task. Inferno leverages historical
          data and cutting-edge predictive models to empower forest managers and
          even common citizens with accurate, data-driven recommendations for
          controlled burns. Inspired by research like that of Coffield et al.
          (2022), which highlights the potential of machine learning to enhance
          wildfire prediction, our app integrates several environmental
          variables such as type and density of vegetation, soil moisture, wind
          speed and direction, temperature and humidity, topography into an
          intuitive platform. Not only does Inferno offer optimal locations on
          where to start a controlled burn, it additionally provides a map
          displaying the risk of wildfires globally. We created Inferno due to
          its originality in the world of science as well as its utility as a
          beneficial product.
        </p>
      </div>
    </section>
  );
};

export default About;
