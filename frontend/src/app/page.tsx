import Hero from "./components/Hero";
import GuestActiveServiceTracker from "./components/GuestActiveServiceTracker";
import BrandMarquee from "./components/BrandMarquee";
import WhyChooseUs from "./components/WhyChooseUs";
import CoverageChecker from "./components/CoverageChecker";
import Services from "./components/Services";
import PricingTable from "./components/PricingTable";
import HowItWorks from "./components/HowItWorks";
import EmergencyCTA from "./components/EmergencyCTA";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import ServiceArea from "./components/ServiceArea";
import ContactCTA from "./components/ContactCTA";
import HomepageActiveServiceTracker from "./components/HomepageActiveServiceTracker";

export default function Home() {
  return (
    <div>
      <Hero />
      <GuestActiveServiceTracker />
      <BrandMarquee />
      <WhyChooseUs />
      <CoverageChecker />
      <Services />
      <PricingTable />
      <HowItWorks />
      <EmergencyCTA />
      <Testimonials />
      <FAQ />
      <ServiceArea />
      <ContactCTA />
      <HomepageActiveServiceTracker />
    </div>
  );
}