'use client'

import { useEffect, useRef } from 'react'

interface Props {
  lat: number
  lng: number
  address: string
}

export default function PropertyMap({ lat, lng, address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let mapboxgl: typeof import('mapbox-gl')
    let map: import('mapbox-gl').Map
    let marker: import('mapbox-gl').Marker

    import('mapbox-gl').then((mod) => {
      mapboxgl = mod

      const Mapbox = mod.default ?? mod
      Mapbox.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

      map = new Mapbox.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [lng, lat],
        zoom: 14,
        attributionControl: false,
      })

      map.addControl(new Mapbox.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new Mapbox.NavigationControl({ showCompass: false }), 'top-right')

      marker = new Mapbox.Marker({ color: '#1A1A1A' })
        .setLngLat([lng, lat])
        .setPopup(new Mapbox.Popup({ offset: 25 }).setText(address))
        .addTo(map)

      mapRef.current = map
    })

    return () => {
      marker?.remove()
      map?.remove()
      mapRef.current = null
    }
  }, [lat, lng, address])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 320, borderRadius: 4, overflow: 'hidden' }}
    />
  )
}
