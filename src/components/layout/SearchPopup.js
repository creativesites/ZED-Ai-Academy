'use client'
import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, X, BookOpen, ChevronRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function SearchPopup({ isPopup, handlePopup }) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (!query.trim()) {
            setResults([])
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from("courses")
                .select("id, title, slug, thumbnail_url, category")
                .ilike("title", `%${query}%`)
                .limit(5)

            if (!error && data) {
                setResults(data)
            }
            setLoading(false)
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    return (
        <>
            <div className={`search-popup ${isPopup ? "active" : ""}`}>
                <div className="search-popup__overlay search-toggler" onClick={handlePopup}></div>
                <div className="search-popup__content p-4 md:p-12">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative mb-12">
                            <input 
                                type="text" 
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search courses, tools, or topics..." 
                                className="w-full bg-white/10 border-2 border-white/20 rounded-[2rem] px-8 py-6 text-2xl text-white placeholder:text-white/40 focus:border-[#fd5523] focus:outline-none transition-all pr-20"
                                autoFocus={isPopup}
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-4">
                                {loading && <Loader2 className="h-6 w-6 text-[#fd5523] animate-spin" />}
                                <button onClick={handlePopup} className="text-white/40 hover:text-white transition-colors">
                                    <X className="h-8 w-8" />
                                </button>
                            </div>
                        </div>

                        {/* Results */}
                        <div className="space-y-4">
                            {results.length > 0 ? (
                                <>
                                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40 mb-6 px-4">Found {results.length} Courses</p>
                                    <div className="grid gap-4">
                                        {results.map(course => (
                                            <Link 
                                                key={course.id} 
                                                href={`/courses/${course.slug}`}
                                                onClick={handlePopup}
                                                className="group flex items-center gap-6 p-4 rounded-[2rem] bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#fd5523]/30 transition-all"
                                            >
                                                <div className="h-16 w-16 rounded-2xl bg-white/10 overflow-hidden shrink-0">
                                                    <img src={course.thumbnail_url || 'https://images.unsplash.com/photo-1675271591211-126ad94e495d?w=200'} alt="" className="h-full w-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#fd5523]">{course.category}</span>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-white truncate group-hover:text-[#fd5523] transition-colors">{course.title}</h3>
                                                </div>
                                                <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-[#fd5523] group-hover:text-white transition-all">
                                                    <ChevronRight className="h-5 w-5" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                    <Link href="/courses" onClick={handlePopup} className="block text-center mt-8 text-sm font-bold text-[#fd5523] hover:underline">
                                        View all courses →
                                    </Link>
                                </>
                            ) : query.trim() && !loading ? (
                                <div className="text-center py-12">
                                    <div className="h-20 w-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center mx-auto mb-6">
                                        <Search className="h-8 w-8 text-white/20" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">No courses found for &quot;{query}&quot;</h3>
                                    <p className="text-white/40">Try searching for &quot;ChatGPT&quot;, &quot;Prompting&quot; or &quot;Midjourney&quot;.</p>
                                </div>
                            ) : null}
                        </div>

                        {/* Quick Links */}
                        {!query.trim() && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-8 px-4">Popular Topics</p>
                                <div className="flex flex-wrap gap-3">
                                    {["ChatGPT", "Midjourney", "AI for Business", "Prompt Engineering", "Zambia Tech"].map(tag => (
                                        <button 
                                            key={tag}
                                            onClick={() => setQuery(tag)}
                                            className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-[#fd5523] hover:border-[#fd5523] transition-all"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
