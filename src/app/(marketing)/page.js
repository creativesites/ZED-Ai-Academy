
import Layout from "@/components/layout/Layout"
import About from "@/components/sections/home2/About"
import WhyChooseUs from "@/components/sections/home2/WhyChooseUs"
import Banner from "@/components/sections/home2/Banner"
import Blog from "@/components/sections/home2/Blog"
import Brands from "@/components/sections/home2/Brands"
import Cta from "@/components/sections/home2/Cta"
import Projects from "@/components/sections/home2/Projects"
import Process from "@/components/sections/home2/Process"
import Service from "@/components/sections/home1/Service"
import Team from "@/components/sections/home2/Team"
import Testimonial from "@/components/sections/home1/Testimonial"
import Faq from "@/components/sections/home1/Faq"
export default function Home() {

    return (
        <>
            <Layout headerStyle={2} footerStyle={1}>
                <Banner />
                <About />
                <Service />
                <Projects />
                <Cta />
                <Team />
                <Testimonial />
                <Faq />
                <WhyChooseUs />
                <Process />
                <Blog />
            </Layout>
        </>
    )
}
