'use client'

import { useState } from 'react'
import { VehiclesPageHeader } from './vehicles-page-header'
import { VehiclesTable } from './vehicles-table'

interface Props {
  vehicles: Parameters<typeof VehiclesTable>[0]['vehicles']
  groups: { id: string; name: string; color: string }[]
  count: number
  page: number
  perPage: number
  search: string
  status: string
  group: string
}

export function VehiclesPageClient(props: Props) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-6">
      <VehiclesPageHeader count={props.count} onAdd={() => setShowModal(true)} />
      <VehiclesTable {...props} showModal={showModal} onCloseModal={() => setShowModal(false)} />
    </div>
  )
}
