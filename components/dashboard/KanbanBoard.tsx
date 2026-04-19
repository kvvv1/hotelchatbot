'use client'

import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { KanbanCard } from './KanbanCard'
import type { Lead, LeadStage } from '@/lib/types/database'

const COLUMNS: { stage: LeadStage; label: string; color: string }[] = [
  { stage: 'new_contact', label: 'Novos contatos', color: 'border-gray-300' },
  { stage: 'in_attendance', label: 'Em atendimento', color: 'border-violet-300' },
  { stage: 'checking_availability', label: 'Consultando', color: 'border-yellow-300' },
  { stage: 'proposal_sent', label: 'Proposta enviada', color: 'border-purple-300' },
  { stage: 'negotiating', label: 'Em negociação', color: 'border-orange-300' },
  { stage: 'booking_in_progress', label: 'Reserva em andamento', color: 'border-purple-300' },
  { stage: 'booked', label: 'Reserva confirmada', color: 'border-green-300' },
  { stage: 'not_converted', label: 'Não convertido', color: 'border-red-300' },
]

interface KanbanBoardProps {
  leadsByStage: Record<string, Lead[]>
  onStageChange: (leadId: string, stage: LeadStage) => Promise<void>
  onLeadClick: (lead: Lead) => void
}

export function KanbanBoard({ leadsByStage, onStageChange, onLeadClick }: KanbanBoardProps) {
  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId, destination } = result
    const newStage = destination.droppableId as LeadStage
    await onStageChange(draggableId, newStage)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto pb-4 px-6 pt-6">
        {COLUMNS.map(({ stage, label, color }) => {
          const columnLeads = leadsByStage[stage] || []
          return (
            <div key={stage} className="flex-shrink-0 w-64">
              <div className={`bg-white rounded-xl border-2 ${color} flex flex-col h-full shadow-sm`}>
                {/* Column header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm text-gray-900">{label}</h3>
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                      {columnLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <Droppable droppableId={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-3 space-y-2 min-h-[100px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-violet-50' : ''
                      }`}
                    >
                      {columnLeads.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onLeadClick(lead)}
                              className={snapshot.isDragging ? 'opacity-80' : ''}
                            >
                              <KanbanCard lead={lead} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
