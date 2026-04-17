import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🍱</div>
      <h1 className="text-3xl font-bold text-orange-600 mb-2">Splash</h1>
      <p className="text-gray-500 mb-8">Fresh food from home kitchens in your society</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/login">
          <Button className="w-full bg-orange-500 hover:bg-orange-600">Order Food</Button>
        </Link>
        <Link href="/seller/listings">
          <Button variant="outline" className="w-full">Seller Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
