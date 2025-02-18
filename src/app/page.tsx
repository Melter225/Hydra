import Header from "../app/components/header.tsx";
import About from "../app/components/about.tsx";
import Map from "../app/components/map.tsx";
import Footer from "../app/components/footer.tsx";

export default function Home() {
  return (
    <div className="min-h-[95svh] flex flex-col">
      <div className="flex-grow">
        <Header />
        <About />
        <Map />
      </div>
      <Footer />
    </div>
  );
}
