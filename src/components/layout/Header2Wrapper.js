'use client'
import { useEffect, useState } from 'react'
import Header2 from './header/Header2'
import MobileMenu from './MobileMenu'

export default function Header2Wrapper() {
    const [scroll, setScroll] = useState(false)
    const [isMobileMenu, setMobileMenu] = useState(false)

    const handleMobileMenu = () => {
        setMobileMenu(!isMobileMenu)
        document.body.classList.toggle('mobile-menu-visible', !isMobileMenu)
    }

    useEffect(() => {
        const handleScroll = () => setScroll(window.scrollY > 100)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <>
            <Header2
                scroll={scroll}
                isMobileMenu={isMobileMenu}
                handleMobileMenu={handleMobileMenu}
            />
            {isMobileMenu && <MobileMenu handleMobileMenu={handleMobileMenu} />}
        </>
    )
}
