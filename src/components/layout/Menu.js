'use client'
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"

export default function Menu() {
    const { isSignedIn, isLoaded } = useAuth()
    return (
        <>
            <ul className="main-menu__list">
                <li>
                    <Link href="/">Home</Link>
                </li>
                <li>
                    <Link href="/#academies">Academies</Link>
                </li>
                <li className="dropdown">
                    <Link href="/pricing">Pricing</Link>
                    <ul>
                        <li><Link href="/pricing">Academy Creator Plans</Link></li>
                        <li><Link href="/pricing#teams">Enterprise &amp; Schools</Link></li>
                    </ul>
                </li>
               
                <li>
                    <Link href="/about">About</Link>
                </li>
                <li>
                    <Link href="/contact">Contact</Link>
                </li>
                {isSignedIn && (
                    <li><Link className="thm-btn" href="/dashboard" style={{ fontSize: '12px', padding: '2px 18px' }}>
                    Your Academies
                    <i className="icon-right-arrow21"></i>
                    <span className="hover-btn hover-bx"></span>
                    <span className="hover-btn hover-bx2"></span>
                    <span className="hover-btn hover-bx3"></span>
                    <span className="hover-btn hover-bx4"></span>
                </Link></li>
                )}
                
            </ul>
        </>
    )
}
