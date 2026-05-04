import Link from "next/link"
export default function Breadcrumb({ breadcrumbTitle }) {
    return (
        <>
         
        <section className="page-header">
            <div className="page-header__bg" style={{ backgroundImage: 'url(assets/images/backgrounds/page-header-bg.jpg)' }}>
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
