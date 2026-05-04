"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { getResolvedPageMediaSlot } from "@/lib/page-media"

export default function Breadcrumb({ breadcrumbTitle }) {
    const [backgroundUrl, setBackgroundUrl] = useState("/images/ufoma-ojo-qcv6ueSHzk0-unsplash.jpg")

    useEffect(() => {
        getResolvedPageMediaSlot("global", "breadcrumb_background", "/images/ufoma-ojo-qcv6ueSHzk0-unsplash.jpg")
            .then(({ url }) => setBackgroundUrl(url))
    }, [])

    return (
        <>
         
        <section className="page-header">
            <div className="page-header__bg" style={{ backgroundImage: `url(images/ufoma-ojo-qcv6ueSHzk0-unsplash.jpg)` }}>
            </div>
            <div className="page-header__pattern"><img src="assets/images/pattern/page-header-pattern.png" alt=""/></div>
            <div className="container">
                <div className="page-header__inner">
                    <h2>{breadcrumbTitle}</h2>
                    <ul className="thm-breadcrumb">
                        <li><Link href="/">Home</Link></li>
                        <li><span className="icon-right-arrow21"></span></li>
                        <li>{breadcrumbTitle}</li>
                    </ul>
                </div>
            </div>
        </section>
      

        </>
    )
}
