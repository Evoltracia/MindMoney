'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { FinancialChart } from '@/components/charts/financial-chart'
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  FileText,
  Eye,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
    lastAutoTable: {
      finalY: number
    }
  }
}

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [dateFilter, setDateFilter] = useState('all')

  useEffect(() => {
    if (!session) {
      router.push('/auth')
      return
    }
    
    if (session.user.role !== 'OWNER') {
      router.push('/dashboard')
      return
    }
    
    loadUsers()
  }, [session, router])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, dateFilter])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else {
        toast.error('Erro ao carregar usuários')
      }
    } catch (error) {
      toast.error('Erro ao carregar usuários')
    } finally {
      setIsLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          filterDate.setDate(now.getDate() - 7)
          break
        case 'month':
          filterDate.setMonth(now.getMonth() - 1)
          break
      }
      
      filtered = filtered.filter(user => 
        new Date(user.createdAt) >= filterDate
      )
    }

    setFilteredUsers(filtered)
  }

  const generateUserReport = (user: any) => {
    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(20)
    doc.text('MindMoney - Relatório do Cliente', 20, 20)
    
    doc.setFontSize(12)
    doc.text(`Cliente: ${user.name || 'N/A'}`, 20, 35)
    doc.text(`E-mail: ${user.email || 'N/A'}`, 20, 45)
    doc.text(`Telefone: ${user.phone || 'N/A'}`, 20, 55)
    doc.text(`Data de Cadastro: ${new Date(user.createdAt).toLocaleDateString('pt-BR')}`, 20, 65)
    doc.text(`Último Acesso: ${new Date(user.lastAccessAt).toLocaleDateString('pt-BR')}`, 20, 75)

    if (user.financialData) {
      // Financial Summary
      doc.setFontSize(16)
      doc.text('Dados Financeiros', 20, 95)
      
      const summaryData = [
        ['Renda Mensal', `R$ ${user.financialData.monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Gastos Mensais', `R$ ${user.financialData.monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Total Livre', `R$ ${(user.financialData.monthlyIncome - user.financialData.monthlyExpenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Cartão de Crédito', `R$ ${user.financialData.creditCardDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Empréstimos', `R$ ${user.financialData.loanDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Cheque Especial', `R$ ${user.financialData.overdraftDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ]

      doc.autoTable({
        startY: 105,
        head: [['Item', 'Valor']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
      })
    }

    // Transactions
    if (user.transactions && user.transactions.length > 0) {
      doc.setFontSize(16)
      const lastY = (doc as any).lastAutoTable?.finalY || 150
      doc.text('Transações', 20, lastY + 20)
      
      const transactionData = user.transactions.slice(0, 10).map((t: any) => [
        new Date(t.date).toLocaleDateString('pt-BR'),
        t.type === 'INCOME' ? 'Receita' : 'Despesa',
        t.description,
        `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ])

      doc.autoTable({
        startY: lastY + 30,
        head: [['Data', 'Tipo', 'Descrição', 'Valor']],
        body: transactionData,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
      })
    }

    doc.save(`cliente-${user.name?.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('Relatório do cliente gerado!')
  }

  const generateAllUsersCSV = () => {
    const csvData = [
      ['MindMoney - Relatório de Usuários'],
      [''],
      ['Data de Geração', new Date().toLocaleDateString('pt-BR')],
      ['Total de Usuários', users.length.toString()],
      [''],
      ['Nome', 'E-mail', 'Telefone', 'Data Cadastro', 'Último Acesso', 'Renda Mensal', 'Gastos Mensais', 'Total Dívidas'],
      ...users.map(user => [
        user.name || 'N/A',
        user.email || 'N/A',
        user.phone || 'N/A',
        new Date(user.createdAt).toLocaleDateString('pt-BR'),
        new Date(user.lastAccessAt).toLocaleDateString('pt-BR'),
        user.financialData?.monthlyIncome || 0,
        user.financialData?.monthlyExpenses || 0,
        user.financialData ? (user.financialData.creditCardDebt + user.financialData.loanDebt + user.financialData.overdraftDebt) : 0
      ])
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `mindmoney-usuarios-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    
    toast.success('CSV de usuários gerado!')
  }

  const getUserChartData = (user: any) => {
    if (!user.financialData) return null

    return {
      summary: {
        labels: ['Renda', 'Gastos', 'Total Livre'],
        values: [
          user.financialData.monthlyIncome,
          user.financialData.monthlyExpenses,
          Math.max(0, user.financialData.monthlyIncome - user.financialData.monthlyExpenses)
        ],
        colors: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(59, 130, 246, 0.8)']
      },
      debts: {
        labels: ['Cartão de Crédito', 'Empréstimos', 'Cheque Especial'],
        values: [
          user.financialData.creditCardDebt,
          user.financialData.loanDebt,
          user.financialData.overdraftDebt
        ],
        colors: ['rgba(239, 68, 68, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(168, 85, 247, 0.8)']
      }
    }
  }

  const getOverallStats = () => {
    const totalUsers = users.length
    const usersWithData = users.filter(u => u.financialData).length
    const totalIncome = users.reduce((sum, u) => sum + (u.financialData?.monthlyIncome || 0), 0)
    const totalDebts = users.reduce((sum, u) => {
      if (!u.financialData) return sum
      return sum + u.financialData.creditCardDebt + u.financialData.loanDebt + u.financialData.overdraftDebt
    }, 0)

    return {
      totalUsers,
      usersWithData,
      avgIncome: usersWithData > 0 ? totalIncome / usersWithData : 0,
      totalDebts
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando painel administrativo...</div>
      </div>
    )
  }

  const stats = getOverallStats()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Header showBackButton />
      
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold text-white mb-4">
              Painel Administrativo
            </h1>
            <p className="text-xl text-slate-300">
              Gestão completa de usuários e relatórios
            </p>
          </motion.div>

          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Usuários</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {stats.totalUsers}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Com Dados</p>
                    <p className="text-2xl font-bold text-green-400">
                      {stats.usersWithData}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Renda Média</p>
                    <p className="text-2xl font-bold text-green-400">
                      R$ {stats.avgIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Dívidas</p>
                    <p className="text-2xl font-bold text-red-400">
                      R$ {stats.totalDebts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Filtros e Ações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar por nome, email ou telefone..."
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all">Todos os períodos</SelectItem>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="week">Última semana</SelectItem>
                    <SelectItem value="month">Último mês</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={generateAllUsersCSV}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">
                Usuários ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-slate-300 pb-3">Nome</th>
                      <th className="text-slate-300 pb-3">E-mail</th>
                      <th className="text-slate-300 pb-3">Telefone</th>
                      <th className="text-slate-300 pb-3">Cadastro</th>
                      <th className="text-slate-300 pb-3">Último Acesso</th>
                      <th className="text-slate-300 pb-3">Status</th>
                      <th className="text-slate-300 pb-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <tr key={index} className="border-b border-slate-700">
                        <td className="text-white py-3 font-medium">
                          {user.name || 'N/A'}
                        </td>
                        <td className="text-slate-300 py-3">{user.email}</td>
                        <td className="text-slate-300 py-3">{user.phone || 'N/A'}</td>
                        <td className="text-slate-300 py-3">
                          {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="text-slate-300 py-3">
                          {new Date(user.lastAccessAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.financialData 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {user.financialData ? 'Completo' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedUser(user)}
                                  className="text-white border-slate-600 hover:bg-slate-700"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="text-white">
                                    Dados de {user.name}
                                  </DialogTitle>
                                </DialogHeader>
                                {selectedUser && (
                                  <div className="space-y-6">
                                    {/* User Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-slate-400 text-sm">E-mail</p>
                                        <p className="text-white">{selectedUser.email}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-400 text-sm">Telefone</p>
                                        <p className="text-white">{selectedUser.phone || 'N/A'}</p>
                                      </div>
                                    </div>

                                    {/* Financial Data */}
                                    {selectedUser.financialData && (
                                      <div className="space-y-4">
                                        <h3 className="text-white font-semibold">Dados Financeiros</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-slate-400 text-sm">Renda Mensal</p>
                                            <p className="text-green-400 font-semibold">
                                              R$ {selectedUser.financialData.monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-slate-400 text-sm">Gastos Mensais</p>
                                            <p className="text-red-400 font-semibold">
                                              R$ {selectedUser.financialData.monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                          </div>
                                        </div>

                                        {/* Charts */}
                                        {(() => {
                                          const chartData = getUserChartData(selectedUser)
                                          return chartData ? (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                              <FinancialChart
                                                title="Resumo"
                                                data={chartData.summary}
                                                showToggle={false}
                                              />
                                              <FinancialChart
                                                title="Dívidas"
                                                data={chartData.debts}
                                                showToggle={false}
                                              />
                                            </div>
                                          ) : null
                                        })()}
                                      </div>
                                    )}

                                    {/* Transactions */}
                                    {selectedUser.transactions && selectedUser.transactions.length > 0 && (
                                      <div className="space-y-4">
                                        <h3 className="text-white font-semibold">Transações Recentes</h3>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                          {selectedUser.transactions.slice(0, 5).map((transaction: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                                              <div>
                                                <p className="text-white text-sm">{transaction.description}</p>
                                                <p className="text-slate-400 text-xs">
                                                  {new Date(transaction.date).toLocaleDateString('pt-BR')}
                                                </p>
                                              </div>
                                              <span className={`font-semibold ${
                                                transaction.type === 'INCOME' ? 'text-green-400' : 'text-red-400'
                                              }`}>
                                                {transaction.type === 'INCOME' ? '+' : '-'}R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>

                            <Button
                              size="sm"
                              onClick={() => generateUserReport(user)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredUsers.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-400">Nenhum usuário encontrado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  )
}