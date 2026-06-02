'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAuthHeaders } from '@/lib/auth-headers';
import { Bot, Filter, Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ClienteOption {
  id: number;
  nombre_completo: string;
  email: string;
}

interface AutomationRecord {
  id: string;
  pa: string;
  proceso: string;
  fecha: string;
  cliente: string;
  cliente_email: string;
  estado: string;
  detalle: string;
  datos: Record<string, unknown>;
}

interface AutomationData {
  resumen: { total: number; pa1: number; pa2: number; pa3: number };
  registros: AutomationRecord[];
}

const PA_OPTIONS = [
  { value: 'todos', label: 'Todos los PA' },
  { value: 'pa1', label: 'PA1 · Fidelización' },
  { value: 'pa2', label: 'PA2 · Reacomodamiento' },
  { value: 'pa3', label: 'PA3 · Racha y cupones' },
];

export default function AuditoriaAutomatizacionesPage() {
  const today = new Date().toISOString().slice(0, 10);
  const past = new Date();
  past.setDate(past.getDate() - 30);

  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [data, setData] = useState<AutomationData | null>(null);
  const [pa, setPa] = useState('todos');
  const [cliente, setCliente] = useState('todos');
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState(past.toISOString().slice(0, 10));
  const [fechaHasta, setFechaHasta] = useState(today);

  const fetchClientes = async () => {
    const response = await fetch('/api/clientes/?page_size=1000', { headers: getAuthHeaders() });
    if (response.ok) {
      const result = await response.json();
      setClientes(result.results || result || []);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pa !== 'todos') params.set('pa', pa);
      if (cliente !== 'todos') params.set('cliente', cliente);
      if (search.trim()) params.set('search', search.trim());
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);

      const response = await fetch(`/api/turnos/reportes/automatizaciones/?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setData(await response.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchClientes();
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (value: string) => new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

  const formatDatos = (datos: Record<string, unknown>) => Object.entries(datos)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 6);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
          <Bot className="h-8 w-8 text-blue-600" />
          Auditoría de Automatizaciones
        </h1>
        <p className="mt-1 max-w-3xl text-slate-600">
          Seguimiento detallado de PA1, PA2 y PA3 con cliente, fechas, estado, datos técnicos y resultado operativo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Buscá por PA, cliente, texto libre y rango de fechas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-6">
          <Select value={pa} onValueChange={setPa}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PA_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={cliente} onValueChange={setCliente}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {clientes.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.nombre_completo}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por detalle, cliente o proceso" />
          </div>
          <Input type="date" value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} />
          <Input type="date" value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} />
          <Button onClick={() => void fetchData()} disabled={loading} className="md:col-start-6">
            <Filter className="mr-2 h-4 w-4" />
            Buscar
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">Total</p><p className="mt-2 text-3xl font-bold">{data?.resumen.total ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">PA1</p><p className="mt-2 text-3xl font-bold">{data?.resumen.pa1 ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">PA2</p><p className="mt-2 text-3xl font-bold">{data?.resumen.pa2 ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">PA3</p><p className="mt-2 text-3xl font-bold">{data?.resumen.pa3 ?? 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos de automatización</CardTitle>
          <CardDescription>Detalle auditable de cada ejecución registrada.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>PA</TableHead>
                    <TableHead>Proceso</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Datos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.registros ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(item.fecha)}</TableCell>
                      <TableCell><Badge>{item.pa}</Badge></TableCell>
                      <TableCell>{item.proceso}</TableCell>
                      <TableCell><div className="font-medium">{item.cliente}</div><div className="text-xs text-slate-500">{item.cliente_email}</div></TableCell>
                      <TableCell><Badge variant="outline">{item.estado}</Badge></TableCell>
                      <TableCell className="max-w-[260px]">{item.detalle}</TableCell>
                      <TableCell className="min-w-[260px] text-xs text-slate-600">
                        <div className="space-y-1">
                          {formatDatos(item.datos).map(([key, value]) => <div key={key}><span className="font-medium">{key}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.registros.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-slate-500">No hay eventos para los filtros seleccionados.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
