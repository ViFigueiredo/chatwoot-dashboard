interface Props {
  message?: string
}

export default function LoadingSpinner({ message = 'Carregando dados...' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-border rounded-full" />
        <div className="absolute top-0 left-0 w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-muted text-sm mt-4">{message}</p>
    </div>
  )
}
