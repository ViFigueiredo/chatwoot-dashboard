import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { hasToken } from '@/lib/api'
import AuthGuard from '@/components/AuthGuard'
import Layout from '@/components/Layout'
import DashboardPage from '@/pages/DashboardPage'
import AgentsPage from '@/pages/AgentsPage'
import ProspectionPage from '@/pages/ProspectionPage'
import AnalysisPage from '@/pages/AnalysisPage'
import IndividualPage from '@/pages/IndividualPage'

export default function App() {
  const [authenticated, setAuthenticated] = useState(hasToken())

  useEffect(() => {
    setAuthenticated(hasToken())
  }, [])

  if (!authenticated) {
    return <AuthGuard onAuthenticated={() => setAuthenticated(true)} />
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agentes" element={<AgentsPage />} />
          <Route path="/prospeccao" element={<ProspectionPage />} />
          <Route path="/analise" element={<AnalysisPage />} />
          <Route path="/consultor" element={<IndividualPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
