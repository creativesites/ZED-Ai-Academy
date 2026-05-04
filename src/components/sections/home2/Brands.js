'use client'
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"


const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 5,
    spaceBetween: 30,
    loop: true,
    autoplay: { delay: 2500, disableOnInteraction: false },
    navigation: {
        nextEl: '.srn',
        prevEl: '.srp',
    },
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    breakpoints: {
        320: { slidesPerView: 2 },
        575: { slidesPerView: 2 },
        767: { slidesPerView: 3 },
        991: { slidesPerView: 3 },
        1199: { slidesPerView: 5 },
        1350: { slidesPerView: 5 },
    }
}

const aiTools = [
    { img: "assets/images/brand/brand-v1-img1.png", name: "ChatGPT" },
    { img: "assets/images/brand/brand-v1-img2.png", name: "Midjourney" },
    { img: "assets/images/brand/brand-v1-img3.png", name: "Claude" },
    { img: "assets/images/brand/brand-v1-img4.png", name: "Firefly" },
    { img: "assets/images/brand/brand-v1-img5.png", name: "Gemini" },
    { img: "assets/images/brand/brand-v1-img6.png", name: "Copilot" },
]

export default function Brand() {
    return (
        <>

        <section className="brand-one">
            <div className="container">
                <Swiper {...swiperOptions} className="brand-one__carousel owl-carousel owl-theme">
                    {aiTools.map((tool) => (
                        <SwiperSlide key={tool.name}>
                        <div className="brand-one__single">
                            <div className="brand-one__single-inner">
                                <img src={tool.img} alt={tool.name}/>
                            </div>
                        </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </section>

        </>
    )
}
