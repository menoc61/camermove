"use client"
import { SearchBar } from "../components/search/search-bar"
export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[#0e9f8f]">CamerMove</h1>
      <p className="mb-4 text-sm text-slate-500">Réservez vos billets entre Yaoundé et Douala</p>
      <SearchBar />
    </main>
  )
}
