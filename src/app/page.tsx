// import Image from "next/image";
import Header from "../app/components/header.tsx";
import About from "../app/components/about.tsx";
import Map from "../app/components/map.tsx";
import Footer from "../app/components/footer.tsx";

export default function Home() {
  return (
    <div>
      <Header />
      <About />
      <Map />
      <Footer />
    </div>
  );
}
