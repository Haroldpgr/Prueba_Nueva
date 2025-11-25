import React, { PropsWithChildren } from 'react'

export default function Card({ children }: PropsWithChildren) {
  return <div className="bg-dark rounded-xl shadow-soft p-4 border border-gray-800">{children}</div>
}

