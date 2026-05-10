
import Layout from "@/components/layout/Layout"
import About from "@/components/sections/home2/About"
import WhyChooseUs from "@/components/sections/home2/WhyChooseUs"
import Banner from "@/components/sections/home2/Banner"
import CoursesSection from "@/components/sections/home2/CoursesSection"
import Blog from "@/components/sections/home2/Blog"
import Brands from "@/components/sections/home2/Brands"
import Cta from "@/components/sections/home2/Cta"
import Projects from "@/components/sections/home2/Projects"
import Process from "@/components/sections/home2/Process"
import LearningExperience from "@/components/sections/home2/LearningExperience"
import Team from "@/components/sections/home2/Team"
import Testimonial from "@/components/sections/home1/Testimonial"
import Faq from "@/components/sections/home1/Faq"
export default function Home() {

    return (
        <>
            <Layout headerStyle={2} footerStyle={1}>
                <Banner />
                <CoursesSection />
                <About />
                <LearningExperience />
                {/* <Projects /> */}
                <Cta />
                {/* <Team /> */}
                <Testimonial />
                <Faq />
                <WhyChooseUs />
                <Process />
                {/* <Blog /> */}
            </Layout>
        </>
    )
}
