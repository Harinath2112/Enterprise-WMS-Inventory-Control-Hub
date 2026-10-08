import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Boxes, Edit2, Eye, MapPin, MoveRight, PackageSearch, Plus, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { showToast } from '../../components/common/toast'
import ModalComponent from '../../components/modals/ModalComponent'
import DatePicker from '../../components/DatePicker'
import QuantityInput from '../../components/QuantityInput'
import SearchableSelect from '../../components/SearchableSelect'
import { DataTable, FilterBar, StatisticsCard, StatusBadge } from '../../components/erp'
import FormModal from '../../layouts/FormModal'
import { formatDate, getToday } from '../../utils/helpers'
import {
  createBinTransfer,
  createBin,
  createPutawayStock,
  createWarehouse,
  createRack,
  deleteBin,
  deleteRack,
  deleteWarehouse,
  getBins,
  getBinStocks,
  getRacks,
  getWarehouseDetails,
  getWarehouseDetailsMap,
  getWarehouseStats,
  getWarehouses,
  updateBin,
  updateRack,
  updateWarehouse,
} from '../../api/warehousesApi'
import { createStockTransfer, getStockRegister, notifyStockDataUpdated } from '../../api/stockApi'
import WarehousesHeader from './components/WarehousesHeader'
import WarehousesTable from './components/WarehousesTable'
import WarehouseForm from './components/WarehouseForm'
import './Warehouses.css'

function SummaryCard({ icon, label, value, helper }) {
  return (
    <StatisticsCard
      icon={icon}
      label={label}
      value={value}
      helper={helper}
      className="warehouses-page__summary-card"
    />
  )
}

function normalizeStatus(value) {
  return String(value ?? '').toLowerCase() === 'inactive' ? 'Inactive' : 'Active'
}

function formatOptionalDate(value) {
  if (!value) {
    return formatDate(getToday())
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return formatDate(getToday())
  }

  return formatDate(value)
}

function normalizeStorageStatus(value) {
  return String(value ?? '').toLowerCase() === 'inactive' ? 'inactive' : 'active'
}

function getRackCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

function getBinCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

function getProductStockKey(productId, variantId = '') {
  return `${String(productId || '')}::${String(variantId || '')}`
}

const initialTransferForm = {
  productId: '',
  fromWarehouseId: '',
  toWarehouseId: '',
  quantity: '',
  date: getToday(),
}

const initialBinTransferForm = {
  productId: '',
  fromBinId: '',
  toBinId: '',
  quantity: '',
}

const initialPutawayForm = {
  productKey: '',
  rackId: '',
  binId: '',
  quantity: '',
}

const detailsTabs = ['Overview', 'Racks', 'Bins', 'Bin Stock']
const emptyRackForm = {
  rackCode: '',
  description: '',
}
const emptyBinForm = {
  rackId: '',
  binCode: '',
  capacity: '',
  status: 'active',
}

export default function Warehouses({
  warehouses: initialWarehouses = [],
  products = [],
}) {
  const { hasPermission } = useAuth()

  const [warehouses, setWarehouses] = useState(initialWarehouses)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [message, setMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [transferForm, setTransferForm] = useState(initialTransferForm)
  const [warehouseStats, setWarehouseStats] = useState(null)
  const [warehouseDetailsById, setWarehouseDetailsById] = useState({})
  const [binStocks, setBinStocks] = useState([])
  const [stockRows, setStockRows] = useState([])
  const [bins, setBins] = useState([])
  const [racks, setRacks] = useState([])
  const [isBinTransferOpen, setIsBinTransferOpen] = useState(false)
  const [binTransferForm, setBinTransferForm] = useState(initialBinTransferForm)
  const [binTransferErrors, setBinTransferErrors] = useState({})
  const [isBinTransferSaving, setIsBinTransferSaving] = useState(false)
  const [isPutawayOpen, setIsPutawayOpen] = useState(false)
  const [putawayForm, setPutawayForm] = useState(initialPutawayForm)
  const [isPutawaySaving, setIsPutawaySaving] = useState(false)
  const [statusSavingId, setStatusSavingId] = useState('')
  const [detailsWarehouse, setDetailsWarehouse] = useState(null)
  const [warehouseDetails, setWarehouseDetails] = useState(null)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  const [detailsTab, setDetailsTab] = useState('Overview')
  const [rackFormMode, setRackFormMode] = useState('')
  const [rackForm, setRackForm] = useState(emptyRackForm)
  const [editingRack, setEditingRack] = useState(null)
  const [binFormMode, setBinFormMode] = useState('')
  const [binForm, setBinForm] = useState(emptyBinForm)
  const [editingBin, setEditingBin] = useState(null)
  const [isStorageSaving, setIsStorageSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [storagePreview, setStoragePreview] = useState(null)
  const [binStockRackFilter, setBinStockRackFilter] = useState('all')
  const [binStockBinFilter, setBinStockBinFilter] = useState('all')
  const [binStockProductFilter, setBinStockProductFilter] = useState('all')

  const canCreate = hasPermission('warehouses', 'create')
  const canEdit = hasPermission('warehouses', 'edit')
  const canDelete = hasPermission('warehouses', 'delete')

  const notify = useCallback((result) => {
    showToast({
      type: result.success ? 'success' : 'error',
      title: 'Warehouses',
      message: result.message,
    })
  }, [])

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await getWarehouses()

      if (!response.success) {
        throw new Error(response.error || 'Warehouses could not be loaded from the IMS API.')
      }

      const nextWarehouses = Array.isArray(response.data) ? response.data : []
      setWarehouses(nextWarehouses)
      setMessage(null)

      const detailsMap = await getWarehouseDetailsMap(nextWarehouses)
      setWarehouseDetailsById(detailsMap)
    } catch (error) {
      const nextMessage = {
        success: false,
        message: error instanceof Error ? error.message : 'Warehouses could not be loaded from the IMS API.',
      }
      setMessage(nextMessage)
      notify(nextMessage)
    } finally {
      setIsLoading(false)
    }
  }, [notify])

  const loadWarehouseStats = useCallback(async () => {
    const response = await getWarehouseStats()

    if (!response.success) {
      console.error('[Warehouse Stats] API failure', response)
      return
    }

    setWarehouseStats(response.data)
  }, [])

  const loadBinStocks = useCallback(async () => {
    const response = await getBinStocks()

    if (!response.success) {
      console.error('[Bin Stocks] API failure', response)
      return
    }

    setBinStocks(Array.isArray(response.data) ? response.data : [])
  }, [])

  const loadStockRows = useCallback(async () => {
    const response = await getStockRegister()

    if (!response.success) {
      console.error('[Stock] API failure', response)
      return
    }

    setStockRows(Array.isArray(response.data) ? response.data : [])
  }, [])

  const loadBins = useCallback(async () => {
    const response = await getBins()

    if (!response.success) {
      console.error('[Bins] API failure', response)
      return
    }

    setBins(Array.isArray(response.data) ? response.data : [])
  }, [])

  const loadRacks = useCallback(async () => {
    const response = await getRacks()

    if (!response.success) {
      console.error('[Racks] API failure', response)
      return
    }

    setRacks(Array.isArray(response.data) ? response.data : [])
  }, [])

  const loadWarehouseDetails = useCallback(async (warehouse) => {
    if (!warehouse?.id) {
      return
    }

    setDetailsWarehouse(warehouse)
    setIsDetailsLoading(true)

    try {
      const response = await getWarehouseDetails(warehouse.id)

      if (!response.success) {
        const result = {
          success: false,
          message: response.error || 'Warehouse details could not be loaded.',
        }
        setMessage(result)
        notify(result)
        console.error('[Warehouse Details] API failure', response)
        return
      }

      setWarehouseDetails(response.data)
    } finally {
      setIsDetailsLoading(false)
    }
  }, [notify])

  const refreshOpenWarehouseDetails = useCallback(async () => {
    if (!detailsWarehouse?.id) {
      return
    }

    await loadWarehouseDetails(detailsWarehouse)
  }, [detailsWarehouse, loadWarehouseDetails])

  useEffect(() => {
    queueMicrotask(loadWarehouses)
  }, [loadWarehouses])

  useEffect(() => {
    queueMicrotask(() => {
      loadWarehouseStats()
      loadBinStocks()
      loadStockRows()
      loadBins()
      loadRacks()
    })
  }, [loadBinStocks, loadBins, loadRacks, loadStockRows, loadWarehouseStats])

  const enrichedWarehouses = useMemo(() => (
    warehouses.map((warehouse) => {
      const details = warehouseDetailsById[String(warehouse.id)]

      return {
        ...warehouse,
        status: normalizeStatus(warehouse.status),
        rackCount: details?.totalRacks ?? warehouse.rackCount ?? 0,
        binCount: details?.totalBins ?? warehouse.binCount ?? 0,
        productCount: details?.totalProducts ?? warehouse.productCount ?? 0,
        stockUnits: details?.totalStockUnits ?? warehouse.stockUnits ?? 0,
        products: warehouse.products ?? details?.products ?? [],
      }
    })
  ), [warehouseDetailsById, warehouses])

  const summary = useMemo(
    () => warehouseStats || ({
      warehouses: enrichedWarehouses.length,
      stockUnits: enrichedWarehouses.reduce((total, warehouse) => total + Number(warehouse.stockUnits || 0), 0),
      racks: enrichedWarehouses.reduce((total, warehouse) => total + Number(warehouse.rackCount || 0), 0),
      bins: enrichedWarehouses.reduce((total, warehouse) => total + Number(warehouse.binCount || 0), 0),
    }),
    [enrichedWarehouses, warehouseStats],
  )

  const rackById = useMemo(() => {
    const nextMap = new Map()

    racks.forEach((rack) => {
      nextMap.set(String(rack.rackId || rack.id), rack)
    })

    return nextMap
  }, [racks])

  const detailsWarehouseId = detailsWarehouse?.id ? String(detailsWarehouse.id) : ''

  const storageLayout = useMemo(() => {
    if (!detailsWarehouseId) {
      return []
    }

    const binStockByBinId = new Map()
    const warehouseRacks = racks
      .filter((rack) => String(rack.warehouseId) === detailsWarehouseId)
      .sort((firstRack, secondRack) => String(firstRack.rackCode).localeCompare(String(secondRack.rackCode)))
    const groupedByRack = new Map()

    binStocks
      .filter((row) => String(row.warehouseId) === detailsWarehouseId)
      .forEach((row) => {
        const currentRows = binStockByBinId.get(String(row.binId)) ?? []
        currentRows.push(row)
        binStockByBinId.set(String(row.binId), currentRows)
      })

    warehouseRacks.forEach((rack) => {
      groupedByRack.set(String(rack.rackId), {
        rackId: String(rack.rackId),
        rackCode: rack.rackCode || 'Rack',
        bins: [],
      })
    })

    const layoutBins = bins
      .filter((bin) => String(bin.warehouseId) === detailsWarehouseId)
      .map((bin) => {
        const stockRows = binStockByBinId.get(String(bin.binId || bin.id)) ?? []
        const quantity = stockRows.reduce((total, row) => total + Number(row.quantity || 0), 0)
        const rack = rackById.get(String(bin.rackId))
        const firstStockRow = stockRows[0]

        return {
          id: String(bin.binId || bin.id),
          rackId: String(bin.rackId || ''),
          binCode: bin.binCode || firstStockRow?.binCode || `Bin ${bin.binId || bin.id}`,
          rackCode: rack?.rackCode || firstStockRow?.rackCode || `Rack ${bin.rackId || ''}`.trim(),
          quantity,
        }
      })

    binStocks
      .filter((row) => String(row.warehouseId) === detailsWarehouseId && !layoutBins.some((bin) => String(bin.id) === String(row.binId)))
      .forEach((row) => {
        layoutBins.push({
          id: String(row.binId),
          rackId: String(row.rackId || ''),
          binCode: row.binCode || `Bin ${row.binId}`,
          rackCode: row.rackCode || 'Rack',
          quantity: Number(row.quantity || 0),
        })
      })

    layoutBins.forEach((bin) => {
      const rackKey = bin.rackId || bin.rackCode || 'Rack'
      const rackGroup = groupedByRack.get(rackKey) ?? {
        rackId: rackKey,
        rackCode: bin.rackCode || 'Rack',
        bins: [],
      }
      rackGroup.bins.push(bin)
      groupedByRack.set(rackKey, rackGroup)
    })

    return Array.from(groupedByRack.values())
      .sort((firstRack, secondRack) => firstRack.rackCode.localeCompare(secondRack.rackCode))
      .map((rack) => ({
        ...rack,
        bins: rack.bins.sort((firstBin, secondBin) => firstBin.binCode.localeCompare(secondBin.binCode)),
        totalBins: rack.bins.length,
        totalQuantity: rack.bins.reduce((total, bin) => total + Number(bin.quantity || 0), 0),
      }))
  }, [binStocks, bins, detailsWarehouseId, rackById, racks])

  const selectedWarehouseRacks = useMemo(
    () => racks
      .filter((rack) => String(rack.warehouseId) === detailsWarehouseId)
      .sort((firstRack, secondRack) => String(firstRack.rackCode).localeCompare(String(secondRack.rackCode))),
    [detailsWarehouseId, racks],
  )

  const selectedWarehouseBins = useMemo(
    () => bins
      .filter((bin) => String(bin.warehouseId) === detailsWarehouseId)
      .map((bin) => ({
        ...bin,
        rackCode: rackById.get(String(bin.rackId))?.rackCode || '',
      }))
      .sort((firstBin, secondBin) => {
        const rackCompare = String(firstBin.rackCode).localeCompare(String(secondBin.rackCode))
        if (rackCompare !== 0) return rackCompare
        return String(firstBin.binCode).localeCompare(String(secondBin.binCode))
      }),
    [bins, detailsWarehouseId, rackById],
  )

  const selectedWarehouseAllBinStocks = useMemo(
    () => binStocks
      .filter((row) => String(row.warehouseId) === detailsWarehouseId),
    [binStocks, detailsWarehouseId],
  )

  const selectedWarehouseBinStocks = useMemo(
    () => selectedWarehouseAllBinStocks
      .filter((row) => binStockRackFilter === 'all' || String(row.rackId) === String(binStockRackFilter))
      .filter((row) => binStockBinFilter === 'all' || String(row.binId) === String(binStockBinFilter))
      .filter((row) => binStockProductFilter === 'all' || String(row.productId || row.productName) === String(binStockProductFilter)),
    [binStockBinFilter, binStockProductFilter, binStockRackFilter, selectedWarehouseAllBinStocks],
  )

  const binStockProductOptions = useMemo(() => {
    const optionMap = new Map()

    selectedWarehouseAllBinStocks.forEach((row) => {
      const id = String(row.productId || row.productName || '')
      if (!id) return
      optionMap.set(id, row.productName || `Product ${id}`)
    })

    return Array.from(optionMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((firstProduct, secondProduct) => firstProduct.name.localeCompare(secondProduct.name))
  }, [selectedWarehouseAllBinStocks])

  const binStockSummary = useMemo(() => {
    const productIds = new Set()
    const occupiedBinIds = new Set()
    let totalQuantity = 0

    selectedWarehouseBinStocks.forEach((row) => {
      const quantity = Number(row.quantity || 0)
      totalQuantity += quantity

      if (row.productId || row.productName) {
        productIds.add(String(row.productId || row.productName))
      }

      if (quantity > 0 && row.binId) {
        occupiedBinIds.add(String(row.binId))
      }
    })

    return {
      products: productIds.size,
      quantity: totalQuantity,
      occupiedBins: occupiedBinIds.size,
    }
  }, [selectedWarehouseBinStocks])

  const rackRows = useMemo(
    () => selectedWarehouseRacks.map((rack) => ({
      ...rack,
      totalBins: selectedWarehouseBins.filter((bin) => String(bin.rackId) === String(rack.rackId)).length,
    })),
    [selectedWarehouseBins, selectedWarehouseRacks],
  )

  const binRows = useMemo(
    () => selectedWarehouseBins.map((bin) => ({
      ...bin,
      currentQuantity: selectedWarehouseAllBinStocks
        .filter((row) => String(row.binId) === String(bin.binId))
        .reduce((total, row) => total + Number(row.quantity || 0), 0),
    })),
    [selectedWarehouseAllBinStocks, selectedWarehouseBins],
  )

  const putawayProductOptions = useMemo(() => {
    const allocatedByProduct = new Map()

    selectedWarehouseAllBinStocks.forEach((row) => {
      const key = getProductStockKey(row.productId, row.variantId)
      allocatedByProduct.set(key, (allocatedByProduct.get(key) || 0) + Number(row.quantity || 0))
    })

    return stockRows
      .filter((row) => String(row.warehouseId) === detailsWarehouseId)
      .map((row) => {
        const key = getProductStockKey(row.productId, row.variantId)
        const warehouseQuantity = Number(row.quantity || 0)
        const allocatedQuantity = Number(allocatedByProduct.get(key) || 0)
        const availableQuantity = Math.max(0, warehouseQuantity - allocatedQuantity)

        return {
          ...row,
          key,
          warehouseQuantity,
          allocatedQuantity,
          availableQuantity,
        }
      })
      .filter((row) => row.availableQuantity > 0)
      .sort((firstProduct, secondProduct) => String(firstProduct.productName).localeCompare(String(secondProduct.productName)))
  }, [detailsWarehouseId, selectedWarehouseAllBinStocks, stockRows])

  const selectedPutawayProduct = useMemo(
    () => putawayProductOptions.find((row) => row.key === putawayForm.productKey) || null,
    [putawayForm.productKey, putawayProductOptions],
  )

  const putawayRackBins = useMemo(
    () => selectedWarehouseBins.filter((bin) => String(bin.rackId) === String(putawayForm.rackId)),
    [putawayForm.rackId, selectedWarehouseBins],
  )

  const selectedPutawayBin = useMemo(
    () => selectedWarehouseBins.find((bin) => String(bin.binId) === String(putawayForm.binId)) || null,
    [putawayForm.binId, selectedWarehouseBins],
  )

  const selectedPutawayBinQuantity = useMemo(
    () => selectedWarehouseAllBinStocks
      .filter((row) => String(row.binId) === String(putawayForm.binId))
      .reduce((total, row) => total + Number(row.quantity || 0), 0),
    [putawayForm.binId, selectedWarehouseAllBinStocks],
  )

  const selectedPutawayBinRemaining = useMemo(() => {
    if (!selectedPutawayBin) {
      return 0
    }

    const capacity = Number(selectedPutawayBin.capacity || 0)

    if (capacity <= 0) {
      return Number.POSITIVE_INFINITY
    }

    return Math.max(0, capacity - selectedPutawayBinQuantity)
  }, [selectedPutawayBin, selectedPutawayBinQuantity])

  const rackColumns = [
    {
      key: 'rackCode',
      label: 'Rack Code',
      sortable: true,
      mobilePrimary: true,
      render: (rack) => <strong>{rack.rackCode || 'Rack'}</strong>,
    },
    {
      key: 'description',
      label: 'Description',
      sortable: true,
      render: (rack) => rack.description || 'No description',
    },
    {
      key: 'totalBins',
      label: 'Total Bins',
      sortable: true,
      render: (rack) => <strong>{rack.totalBins}</strong>,
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      sortable: true,
      sortValue: (rack) => new Date(rack.createdAt || rack.createdDate || rack.createdOn || 0).getTime() || Date.now(),
      render: (rack) => formatOptionalDate(rack.createdAt || rack.createdDate || rack.createdOn),
    },
    {
      key: 'actions',
      label: 'Actions',
      searchable: false,
      render: (rack) => (
        <div className="table-actions table-actions--nowrap warehouses-page__actions-cell">
          <button
            type="button"
            className="button warehouses-action-button warehouses-action-button--details"
            title="View rack"
            data-tooltip="View"
            onClick={() => setStoragePreview({
              type: 'rack',
              title: rack.rackCode || 'Rack',
              fields: [
                ['Rack Code', rack.rackCode || '-'],
                ['Description', rack.description || 'No description'],
                ['Total Bins', rack.totalBins],
                ['Created Date', formatOptionalDate(rack.createdAt || rack.createdDate || rack.createdOn)],
              ],
            })}
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            className="button warehouses-action-button"
            title="Edit rack"
            data-tooltip="Edit"
            onClick={() => openEditRack(rack)}
          >
            <Edit2 size={15} />
          </button>
          <button
            type="button"
            className="button button-danger warehouses-action-button warehouses-action-button--danger"
            title="Delete rack"
            data-tooltip="Delete"
            onClick={() => requestDeleteRack(rack)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const binColumns = [
    {
      key: 'binCode',
      label: 'Bin Code',
      sortable: true,
      mobilePrimary: true,
      render: (bin) => <strong>{bin.binCode || 'Bin'}</strong>,
    },
    {
      key: 'rackCode',
      label: 'Rack',
      sortable: true,
      render: (bin) => bin.rackCode || '-',
    },
    {
      key: 'capacity',
      label: 'Capacity',
      sortable: true,
      render: (bin) => <strong>{Number(bin.capacity || 0)}</strong>,
    },
    {
      key: 'currentQuantity',
      label: 'Current Quantity',
      sortable: true,
      render: (bin) => <strong>{Number(bin.currentQuantity || 0)}</strong>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (bin) => <StatusBadge status={normalizeStatus(bin.status)} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      searchable: false,
      render: (bin) => (
        <div className="table-actions table-actions--nowrap warehouses-page__actions-cell">
          <button
            type="button"
            className="button warehouses-action-button warehouses-action-button--details"
            title="View bin"
            data-tooltip="View"
            onClick={() => setStoragePreview({
              type: 'bin',
              title: bin.binCode || 'Bin',
              fields: [
                ['Bin Code', bin.binCode || '-'],
                ['Rack', bin.rackCode || '-'],
                ['Capacity', Number(bin.capacity || 0)],
                ['Current Quantity', Number(bin.currentQuantity || 0)],
                ['Status', normalizeStatus(bin.status)],
              ],
            })}
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            className="button warehouses-action-button"
            title="Edit bin"
            data-tooltip="Edit"
            onClick={() => openEditBin(bin)}
          >
            <Edit2 size={15} />
          </button>
          <button
            type="button"
            className="button button-danger warehouses-action-button warehouses-action-button--danger"
            title="Delete bin"
            data-tooltip="Delete"
            onClick={() => requestDeleteBin(bin)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const binStockColumns = useMemo(
    () => [
      {
        key: 'productName',
        label: 'Product',
        sortable: true,
        mobilePrimary: true,
      },
      {
        key: 'rackCode',
        label: 'Rack',
        sortable: true,
      },
      {
        key: 'binCode',
        label: 'Bin',
        sortable: true,
      },
      {
        key: 'quantity',
        label: 'Quantity',
        sortable: true,
        render: (row) => <strong>{row.quantity}</strong>,
      },
    ],
    [],
  )

  const binOptions = useMemo(() => {
    const optionMap = new Map()

    bins.forEach((bin) => {
      optionMap.set(String(bin.id), bin)
    })

    binStocks.forEach((row) => {
      if (!optionMap.has(String(row.binId))) {
        optionMap.set(String(row.binId), {
          id: row.binId,
          binId: row.binId,
          name: row.binCode || `Bin ${row.binId}`,
          label: row.binCode || `Bin ${row.binId}`,
          binCode: row.binCode,
          warehouseId: row.warehouseId,
          rackId: row.rackId,
        })
      }
    })

    return Array.from(optionMap.values()).map((bin) => {
      const matchingStock = binStocks.find((row) => String(row.binId) === String(bin.id))
      const warehouse = warehouses.find((item) => String(item.id) === String(bin.warehouseId))
      const labelParts = [
        bin.binCode || bin.name || `Bin ${bin.id}`,
        warehouse?.name || matchingStock?.warehouseName,
      ].filter(Boolean)
      const label = labelParts.join(' - ')

      return {
        ...bin,
        label,
        name: label,
      }
    })
  }, [binStocks, bins, warehouses])

  const sourceBinOptions = useMemo(() => {
    const filteredRows = binTransferForm.productId
      ? binStocks.filter((row) => String(row.productId) === String(binTransferForm.productId) && Number(row.quantity) > 0)
      : binStocks.filter((row) => Number(row.quantity) > 0)

    return filteredRows.map((row) => {
      const sourceKey = row.binStockId || `${row.productId}:${row.variantId || 'base'}:${row.binId}`

      return {
        id: sourceKey,
        value: sourceKey,
        binId: row.binId,
        productId: row.productId,
        variantId: row.variantId,
        warehouseId: row.warehouseId,
        availableQuantity: Number(row.quantity || 0),
        label: `${row.binCode} - ${row.warehouseName} (${row.quantity} available)`,
        name: `${row.binCode} - ${row.warehouseName} (${row.quantity} available)`,
      }
    })
  }, [binStocks, binTransferForm.productId])

  const selectedSourceBinOption = useMemo(
    () => sourceBinOptions.find((bin) => String(bin.id) === String(binTransferForm.fromBinId)) || null,
    [binTransferForm.fromBinId, sourceBinOptions],
  )

  const destinationBinOptions = useMemo(
    () => binOptions.filter((bin) => (
      String(bin.id) !== String(selectedSourceBinOption?.binId ?? binTransferForm.fromBinId) &&
      (!selectedSourceBinOption?.warehouseId || String(bin.warehouseId) === String(selectedSourceBinOption.warehouseId))
    )),
    [binOptions, binTransferForm.fromBinId, selectedSourceBinOption],
  )

  const selectedDestinationBinOption = useMemo(
    () => destinationBinOptions.find((bin) => String(bin.id) === String(binTransferForm.toBinId)) || null,
    [binTransferForm.toBinId, destinationBinOptions],
  )

  const destinationBinQuantity = useMemo(
    () => binStocks
      .filter((row) => String(row.binId) === String(binTransferForm.toBinId))
      .reduce((total, row) => total + Number(row.quantity || 0), 0),
    [binStocks, binTransferForm.toBinId],
  )

  const destinationBinAvailableCapacity = useMemo(() => {
    if (!selectedDestinationBinOption || !Number(selectedDestinationBinOption.capacity)) {
      return null
    }

    return Math.max(0, Number(selectedDestinationBinOption.capacity) - destinationBinQuantity)
  }, [destinationBinQuantity, selectedDestinationBinOption])


  function handleOpenCreate() {
    setEditingWarehouse(null)
    setIsFormOpen(true)
  }

  function handleEdit(item) {
    setEditingWarehouse(item)
    setIsFormOpen(true)
  }

  function handleCloseForm() {
    if (isSaving) {
      return
    }

    setEditingWarehouse(null)
    setIsFormOpen(false)
  }

  async function handleSave(values) {
    setIsSaving(true)

    try {
      const response = editingWarehouse?.id
        ? await updateWarehouse(editingWarehouse.id, values)
        : await createWarehouse(values)

      const result = response.success
        ? {
            success: true,
            message: editingWarehouse
              ? 'Warehouse updated successfully.'
              : 'Warehouse created successfully.',
          }
        : { success: false, message: response.error || 'Warehouse save failed.' }

      setMessage(result)
      notify(result)

      if (response.success) {
        await loadWarehouses()
        setEditingWarehouse(null)
        setIsFormOpen(false)
      }
    } catch (error) {
      const result = {
        success: false,
        message: error instanceof Error ? error.message : 'Warehouse save failed.',
      }

      setMessage(result)
      notify(result)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(warehouse, status) {
    if (!warehouse?.id || !canEdit) {
      return
    }

    const nextStatus = normalizeStatus(status)
    const currentStatus = normalizeStatus(warehouse.status)

    if (nextStatus === currentStatus) {
      return
    }

    setStatusSavingId(String(warehouse.id))

    try {
      const payload = {
        ...warehouse,
        name: warehouse.name,
        location: warehouse.location,
        status: nextStatus,
      }
      const response = await updateWarehouse(warehouse.id, payload)
      const result = response.success
        ? { success: true, message: 'Warehouse status updated.' }
        : { success: false, message: response.error || 'Warehouse status update failed.' }

      setMessage(result)
      notify(result)

      if (!response.success) {
        return
      }

      setWarehouses((currentValue) => currentValue.map((item) => (
        String(item.id) === String(warehouse.id)
          ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() }
          : item
      )))

      await loadWarehouses()
      if (detailsWarehouse?.id && String(detailsWarehouse.id) === String(warehouse.id)) {
        setDetailsWarehouse((currentValue) => currentValue ? { ...currentValue, status: nextStatus } : currentValue)
        await refreshOpenWarehouseDetails()
      }
    } finally {
      setStatusSavingId('')
    }
  }

  async function handleDelete(id) {
    const response = await deleteWarehouse(id)
    const nextMessage = response.success
      ? { success: true, message: 'Warehouse deleted successfully.' }
      : { success: false, message: response.error || 'Warehouse delete failed.' }

    setMessage(nextMessage)
    notify(nextMessage)

    if (response.success) {
      await loadWarehouses()
      if (editingWarehouse?.id === id) {
        handleCloseForm()
      }
    }
  }

  function handleTransferChange(event) {
    const { name, value } = event.target
    setTransferForm((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))
  }

  function handleBinTransferChange(event) {
    const { name, value } = event.target
    setBinTransferErrors((currentValue) => ({
      ...currentValue,
      [name]: '',
      form: '',
    }))
    setBinTransferForm((currentValue) => ({
      ...currentValue,
      [name]: value,
      ...(name === 'productId' ? { fromBinId: '', toBinId: '' } : {}),
      ...(name === 'fromBinId' ? { toBinId: currentValue.toBinId === value ? '' : currentValue.toBinId } : {}),
    }))
  }

  function handleCloseWarehouseDetails() {
    setDetailsWarehouse(null)
    setWarehouseDetails(null)
    setDetailsTab('Overview')
    setRackFormMode('')
    setBinFormMode('')
    setConfirmAction(null)
    setBinStockRackFilter('all')
    setBinStockBinFilter('all')
    setBinStockProductFilter('all')
    setIsPutawayOpen(false)
    setPutawayForm(initialPutawayForm)
  }

  async function refreshWarehouseStorage() {
    await Promise.all([
      loadRacks(),
      loadBins(),
      loadBinStocks(),
      loadStockRows(),
      loadWarehouseStats(),
      loadWarehouses(),
      refreshOpenWarehouseDetails(),
    ])
  }

  function openPutawayForm() {
    setPutawayForm({
      ...initialPutawayForm,
      productKey: putawayProductOptions[0]?.key || '',
      rackId: selectedWarehouseRacks[0]?.rackId || '',
      binId: '',
    })
    setIsPutawayOpen(true)
  }

  function closePutawayForm() {
    if (isPutawaySaving) return
    setPutawayForm(initialPutawayForm)
    setIsPutawayOpen(false)
  }

  function handlePutawayFormChange(event) {
    const { name, value } = event.target
    setPutawayForm((currentValue) => ({
      ...currentValue,
      [name]: value,
      ...(name === 'rackId' ? { binId: '' } : {}),
    }))
  }

  async function handlePutawaySubmit(event) {
    event.preventDefault()

    const quantity = Number(putawayForm.quantity)

    if (!selectedPutawayProduct || !putawayForm.rackId || !putawayForm.binId || !putawayForm.quantity) {
      notify({ success: false, message: 'Choose product, warehouse, rack, bin, and quantity for putaway.' })
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      notify({ success: false, message: 'Putaway quantity must be greater than 0.' })
      return
    }

    if (quantity > Number(selectedPutawayProduct.availableQuantity || 0)) {
      notify({ success: false, message: 'Putaway quantity exceeds available unallocated warehouse stock.' })
      return
    }

    if (Number.isFinite(selectedPutawayBinRemaining) && quantity > selectedPutawayBinRemaining) {
      notify({ success: false, message: 'Putaway quantity exceeds remaining bin capacity.' })
      return
    }

    setIsPutawaySaving(true)

    try {
      const payload = {
        productId: Number(selectedPutawayProduct.productId),
        variantId: selectedPutawayProduct.variantId ? Number(selectedPutawayProduct.variantId) : null,
        warehouseId: Number(detailsWarehouseId),
        rackId: Number(putawayForm.rackId),
        binId: Number(putawayForm.binId),
        quantity,
      }

      const response = await createPutawayStock(payload)
      const result = response.success
        ? { success: true, message: 'Stock putaway completed successfully.' }
        : { success: false, message: response.error || 'Stock putaway failed.' }

      notify(result)

      if (!response.success) {
        return
      }

      setPutawayForm(initialPutawayForm)
      setIsPutawayOpen(false)
      notifyStockDataUpdated({
        source: 'putaway-stock',
        warehouseId: payload.warehouseId,
        productId: payload.productId,
      })
      await refreshWarehouseStorage()
    } finally {
      setIsPutawaySaving(false)
    }
  }

  function openAddRack() {
    setEditingRack(null)
    setRackForm(emptyRackForm)
    setRackFormMode('create')
  }

  function openEditRack(rack) {
    setEditingRack(rack)
    setRackForm({
      rackCode: rack.rackCode || '',
      description: rack.description || '',
    })
    setRackFormMode('edit')
  }

  function closeRackForm() {
    if (isStorageSaving) return
    setEditingRack(null)
    setRackForm(emptyRackForm)
    setRackFormMode('')
  }

  function handleRackFormChange(event) {
    const { name, value } = event.target
    setRackForm((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))
  }

  async function handleRackSubmit(event) {
    event.preventDefault()

    const rackCode = getRackCode(rackForm.rackCode)

    if (!rackCode) {
      notify({ success: false, message: 'Rack code is required.' })
      return
    }

    const duplicateRack = selectedWarehouseRacks.find((rack) => (
      getRackCode(rack.rackCode) === rackCode &&
      String(rack.rackId) !== String(editingRack?.rackId ?? '')
    ))

    if (duplicateRack) {
      notify({ success: false, message: 'Rack code already exists in this warehouse.' })
      return
    }

    setIsStorageSaving(true)

    try {
      const createdDateVal = editingRack?.createdAt || editingRack?.createdDate || new Date().toISOString()
      const payload = {
        warehouseId: Number(detailsWarehouseId),
        zoneId: editingRack?.zoneId ?? null,
        rackCode,
        description: rackForm.description.trim(),
        createdAt: createdDateVal,
        createdDate: createdDateVal,
      }
      const response = editingRack?.rackId
        ? await updateRack(editingRack.rackId, payload)
        : await createRack(payload)
      const result = response.success
        ? { success: true, message: editingRack ? 'Rack updated successfully.' : 'Rack added successfully.' }
        : { success: false, message: response.error || 'Rack save failed.' }

      notify(result)

      if (response.success) {
        setEditingRack(null)
        setRackForm(emptyRackForm)
        setRackFormMode('')
        await refreshWarehouseStorage()
      }
    } finally {
      setIsStorageSaving(false)
    }
  }

  function requestDeleteRack(rack) {
    const rackBins = selectedWarehouseBins.filter((bin) => String(bin.rackId) === String(rack.rackId))

    if (rackBins.length > 0) {
      notify({ success: false, message: 'Rack cannot be deleted because it contains bins.' })
      return
    }

    setConfirmAction({
      title: 'Delete Rack',
      message: `Delete rack ${rack.rackCode}? This action cannot be undone.`,
      confirmLabel: 'Delete Rack',
      onConfirm: async () => {
        const response = await deleteRack(rack.rackId)
        const result = response.success
          ? { success: true, message: 'Rack deleted successfully.' }
          : { success: false, message: response.error || 'Rack delete failed.' }

        notify(result)
        if (response.success) {
          await refreshWarehouseStorage()
        }
      },
    })
  }

  function openAddBin() {
    setEditingBin(null)
    setBinForm({
      ...emptyBinForm,
      rackId: selectedWarehouseRacks[0]?.rackId || '',
    })
    setBinFormMode('create')
  }

  function openEditBin(bin) {
    setEditingBin(bin)
    setBinForm({
      rackId: bin.rackId || '',
      binCode: bin.binCode || '',
      capacity: String(bin.capacity || ''),
      status: normalizeStorageStatus(bin.status),
    })
    setBinFormMode('edit')
  }

  function closeBinForm() {
    if (isStorageSaving) return
    setEditingBin(null)
    setBinForm(emptyBinForm)
    setBinFormMode('')
  }

  function handleBinFormChange(event) {
    const { name, value } = event.target
    setBinForm((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))
  }

  async function handleBinSubmit(event) {
    event.preventDefault()

    const binCode = getBinCode(binForm.binCode)
    const capacity = Number(binForm.capacity)

    if (!binForm.rackId) {
      notify({ success: false, message: 'Choose a rack for this bin.' })
      return
    }

    if (!binCode) {
      notify({ success: false, message: 'Bin code is required.' })
      return
    }

    if (!Number.isFinite(capacity) || capacity <= 0) {
      notify({ success: false, message: 'Bin capacity must be greater than 0.' })
      return
    }

    const duplicateBin = selectedWarehouseBins.find((bin) => (
      String(bin.rackId) === String(binForm.rackId) &&
      getBinCode(bin.binCode) === binCode &&
      String(bin.binId) !== String(editingBin?.binId ?? '')
    ))

    if (duplicateBin) {
      notify({ success: false, message: 'Bin code already exists in this rack.' })
      return
    }

    setIsStorageSaving(true)

    try {
      const payload = {
        warehouseId: Number(detailsWarehouseId),
        rackId: Number(binForm.rackId),
        binCode,
        capacity,
        status: normalizeStorageStatus(binForm.status),
      }
      const response = editingBin?.binId
        ? await updateBin(editingBin.binId, payload)
        : await createBin(payload)
      const result = response.success
        ? { success: true, message: editingBin ? 'Bin updated successfully.' : 'Bin added successfully.' }
        : { success: false, message: response.error || 'Bin save failed.' }

      notify(result)

      if (response.success) {
        setEditingBin(null)
        setBinForm(emptyBinForm)
        setBinFormMode('')
        await refreshWarehouseStorage()
      }
    } finally {
      setIsStorageSaving(false)
    }
  }

  function requestDeleteBin(bin) {
    const binQuantity = binStocks
      .filter((row) => String(row.binId) === String(bin.binId))
      .reduce((total, row) => total + Number(row.quantity || 0), 0)

    if (binQuantity > 0) {
      notify({ success: false, message: 'Bin cannot be deleted because stock exists in it.' })
      return
    }

    setConfirmAction({
      title: 'Delete Bin',
      message: `Delete bin ${bin.binCode}? This action cannot be undone.`,
      confirmLabel: 'Delete Bin',
      onConfirm: async () => {
        const response = await deleteBin(bin.binId)
        const result = response.success
          ? { success: true, message: 'Bin deleted successfully.' }
          : { success: false, message: response.error || 'Bin delete failed.' }

        notify(result)
        if (response.success) {
          await refreshWarehouseStorage()
        }
      },
    })
  }

  async function runConfirmAction() {
    if (!confirmAction?.onConfirm) {
      return
    }

    setIsStorageSaving(true)

    try {
      await confirmAction.onConfirm()
      setConfirmAction(null)
    } finally {
      setIsStorageSaving(false)
    }
  }

  async function handleTransferSubmit(event) {
    event.preventDefault()

    if (
      !transferForm.productId ||
      !transferForm.fromWarehouseId ||
      !transferForm.toWarehouseId ||
      !transferForm.quantity ||
      !transferForm.date
    ) {
      const result = {
        success: false,
        message: 'Choose the product, source, destination, quantity, and date to transfer stock.',
      }
      setMessage(result)
      notify(result)
      return
    }

    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
      const result = {
        success: false,
        message: 'Source and destination warehouses must be different.',
      }
      setMessage(result)
      notify(result)
      return
    }

    const payload = {
      productId: Number(transferForm.productId),
      variantId: null,
      quantity: Number(transferForm.quantity),
      fromWarehouseId: Number(transferForm.fromWarehouseId),
      toWarehouseId: Number(transferForm.toWarehouseId),
      transferDate: transferForm.date,
      status: 'completed',
    }

    try {
      const response = await createStockTransfer(payload)
      console.log('[Stock Transfer] Response', response)

      const result = response.success
        ? { success: true, message: response.message || 'Stock transferred successfully.' }
        : { success: false, message: response.error || 'Stock transfer failed.' }

      setMessage(result)
      notify(result)

      if (!response.success) {
        console.error('[Stock Transfer] API failure', response)
        return
      }

      notifyStockDataUpdated({
        source: 'warehouses-transfer',
        productId: payload.productId,
        fromWarehouseId: payload.fromWarehouseId,
        toWarehouseId: payload.toWarehouseId,
        quantity: payload.quantity,
      })
      await Promise.all([
        loadWarehouses(),
        loadWarehouseStats(),
        loadBinStocks(),
        loadStockRows(),
        refreshOpenWarehouseDetails(),
      ])
      setTransferForm(initialTransferForm)
      setIsTransferOpen(false)
    } catch (error) {
      console.error('[Stock Transfer] Unexpected failure', error)
      const result = {
        success: false,
        message: error instanceof Error ? error.message : 'Stock transfer failed.',
      }
      setMessage(result)
      notify(result)
    }
  }

  async function handleBinTransferSubmit(event) {
    event.preventDefault()

    const quantity = Number(binTransferForm.quantity)
    const nextErrors = {}

    if (!binTransferForm.productId || !binTransferForm.fromBinId || !binTransferForm.toBinId || !binTransferForm.quantity) {
      if (!binTransferForm.productId) nextErrors.productId = 'Select a product.'
      if (!binTransferForm.fromBinId) nextErrors.fromBinId = 'Select a source bin.'
      if (!binTransferForm.toBinId) nextErrors.toBinId = 'Select a destination bin.'
      if (!binTransferForm.quantity) nextErrors.quantity = 'Enter a quantity.'
      const result = {
        success: false,
        message: 'Choose the product, source bin, destination bin, and quantity to transfer stock.',
      }
      setBinTransferErrors(nextErrors)
      setMessage(result)
      notify(result)
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      nextErrors.quantity = 'Quantity must be greater than 0.'
      const result = {
        success: false,
        message: 'Bin transfer quantity must be greater than 0.',
      }
      setBinTransferErrors(nextErrors)
      setMessage(result)
      notify(result)
      return
    }

    if (selectedSourceBinOption && String(selectedSourceBinOption.binId) === String(binTransferForm.toBinId)) {
      nextErrors.toBinId = 'Choose a different destination bin.'
      const result = {
        success: false,
        message: 'Source and destination bins must be different.',
      }
      setBinTransferErrors(nextErrors)
      setMessage(result)
      notify(result)
      return
    }

    if (!selectedSourceBinOption) {
      nextErrors.fromBinId = 'Source bin stock could not be found.'
      const result = {
        success: false,
        message: 'Source bin stock could not be found. Refresh and try again.',
      }
      setBinTransferErrors(nextErrors)
      setMessage(result)
      notify(result)
      return
    }

    if (quantity > Number(selectedSourceBinOption.availableQuantity || 0)) {
      nextErrors.quantity = `Maximum available quantity is ${selectedSourceBinOption.availableQuantity}.`
      const result = {
        success: false,
        message: 'Bin transfer quantity exceeds available source bin stock.',
      }
      setBinTransferErrors(nextErrors)
      setMessage(result)
      notify(result)
      return
    }

    if (destinationBinAvailableCapacity !== null && quantity > destinationBinAvailableCapacity) {
      nextErrors.quantity = `Destination bin can accept ${destinationBinAvailableCapacity} more.`
      const result = {
        success: false,
        message: 'Bin transfer quantity exceeds destination bin capacity.',
      }
      setBinTransferErrors(nextErrors)
      setMessage(result)
      notify(result)
      return
    }

    const payload = {
      productId: Number(binTransferForm.productId),
      variantId: selectedSourceBinOption.variantId ? Number(selectedSourceBinOption.variantId) : null,
      fromBinId: Number(selectedSourceBinOption.binId),
      toBinId: Number(binTransferForm.toBinId),
      quantity,
    }

    setIsBinTransferSaving(true)

    try {
      const response = await createBinTransfer(payload)
      console.log('[Bin Transfer] Response', response)

      const result = response.success
        ? { success: true, message: response.message || 'Bin transfer completed successfully.' }
        : { success: false, message: response.error || 'Bin transfer failed.' }

      setMessage(result)
      notify(result)

      if (!response.success) {
        console.error('[Bin Transfer] API failure', response)
        setBinTransferErrors({ form: result.message })
        return
      }

      notifyStockDataUpdated({
        source: 'bin-transfer',
        productId: payload.productId,
        fromBinId: payload.fromBinId,
        toBinId: payload.toBinId,
        quantity: payload.quantity,
      })

      await Promise.all([
        loadWarehouseStats(),
        loadBinStocks(),
        loadStockRows(),
        refreshOpenWarehouseDetails(),
      ])

      setBinTransferForm(initialBinTransferForm)
      setBinTransferErrors({})
      setIsBinTransferOpen(false)
    } catch (error) {
      console.error('[Bin Transfer] Unexpected failure', error)
      const result = {
        success: false,
        message: error instanceof Error ? error.message : 'Bin transfer failed.',
      }
      setBinTransferErrors({ form: result.message })
      setMessage(result)
      notify(result)
    } finally {
      setIsBinTransferSaving(false)
    }
  }

  return (
    <div className="page warehouses-page">
      <WarehousesHeader
        canCreate={canCreate}
        summary={summary}
        onAdd={handleOpenCreate}
      />

      {message ? (
        <div
          className={`message-box ${message.success ? 'message-box--success' : 'message-box--error page-error-banner'}`}
          role={message.success ? 'status' : 'alert'}
        >
          {message.message}
        </div>
      ) : null}

      <WarehousesTable
        warehouses={enrichedWarehouses}
        products={products}
        loading={isLoading}
        canEdit={canEdit}
        canDelete={canDelete}
        statusSavingId={statusSavingId}
        onViewDetails={loadWarehouseDetails}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={canEdit ? handleStatusChange : undefined}
        onTransfer={() => setIsTransferOpen(true)}
        onBinTransfer={() => setIsBinTransferOpen(true)}
        emptyMessage={isLoading ? 'Loading warehouses...' : 'No warehouses available.'}
      />

      {isFormOpen || editingWarehouse ? (
        <FormModal
          title={editingWarehouse ? 'Edit Warehouse' : 'Create Warehouse'}
          subtitle={null}
          icon={null}
          className="warehouses-page__form-modal"
          dialogClassName="warehouses-page__form-dialog"
          bodyClassName="warehouses-page__form-body"
          onClose={handleCloseForm}
        >
          <WarehouseForm
            key={editingWarehouse?.id ?? 'new'}
            initialValues={editingWarehouse}
            canSubmit={editingWarehouse ? canEdit : canCreate}
            isSubmitting={isSaving}
            mode={editingWarehouse ? 'edit' : 'create'}
            onSubmit={handleSave}
            onCancel={handleCloseForm}
          />
        </FormModal>
      ) : null}

      {isTransferOpen ? (
        <ModalComponent
          title="Transfer Stock"
          subtitle="Move stock from one warehouse to another without leaving the warehouse module."
          onClose={() => setIsTransferOpen(false)}
        >
          <div className="card">
            <form className="form-grid form-grid--single" onSubmit={handleTransferSubmit}>
              <SearchableSelect
                id="transfer-product"
                name="productId"
                label="Product"
                icon={Boxes}
                value={transferForm.productId}
                onChange={handleTransferChange}
                options={products}
                placeholder="Select product"
              />

              <SearchableSelect
                id="transfer-from"
                name="fromWarehouseId"
                label="From Warehouse"
                icon={WarehouseIcon}
                value={transferForm.fromWarehouseId}
                onChange={handleTransferChange}
                options={warehouses}
                placeholder="Select source warehouse"
              />

              <SearchableSelect
                id="transfer-to"
                name="toWarehouseId"
                label="To Warehouse"
                icon={WarehouseIcon}
                value={transferForm.toWarehouseId}
                onChange={handleTransferChange}
                options={warehouses.filter((warehouse) => warehouse.id !== transferForm.fromWarehouseId)}
                placeholder="Select destination warehouse"
              />

              <QuantityInput
                id="transfer-quantity"
                name="quantity"
                label="Quantity"
                icon={Boxes}
                value={transferForm.quantity}
                onChange={handleTransferChange}
              />

              <DatePicker
                id="transfer-date"
                name="date"
                label="Transfer Date"
                value={transferForm.date}
                onChange={handleTransferChange}
              />

              <div className="button-row">
                <button className="button button-primary">
                  <MoveRight size={16} />
                  Transfer
                </button>
                <button type="button" className="button button-cancel" onClick={() => setIsTransferOpen(false)}>
                  Close
                </button>
              </div>
            </form>
          </div>
        </ModalComponent>
      ) : null}

      {detailsWarehouse ? (
        <ModalComponent
          title="Warehouse Details"
          subtitle="Review storage layout, stock units, and product bin locations."
          onClose={handleCloseWarehouseDetails}
        >
          <div className="warehouses-page__details">
            <section className="warehouses-page__details-header" aria-label="Warehouse information">
              <div>
                <h2 className="warehouses-page__details-title">
                  {warehouseDetails?.warehouseName || detailsWarehouse.name}
                </h2>
                <div className="warehouses-page__details-meta">
                  <span>
                    <MapPin size={14} />
                    {detailsWarehouse.location || 'Location not set'}
                  </span>
                  <StatusBadge status={normalizeStatus(detailsWarehouse.status)} />
                </div>
              </div>
            </section>

            <div className="warehouses-page__details-stats">
              <SummaryCard
                icon={WarehouseIcon}
                label="Racks"
                value={isDetailsLoading ? '-' : warehouseDetails?.totalRacks ?? 0}
              />
              <SummaryCard
                icon={Boxes}
                label="Bins"
                value={isDetailsLoading ? '-' : warehouseDetails?.totalBins ?? 0}
              />
              <SummaryCard
                icon={PackageSearch}
                label="Products"
                value={isDetailsLoading ? '-' : warehouseDetails?.totalProducts ?? 0}
              />
              <SummaryCard
                icon={MoveRight}
                label="Stock Units"
                value={isDetailsLoading ? '-' : warehouseDetails?.totalStockUnits ?? 0}
              />
            </div>

            <div className="warehouses-page__tabs" role="tablist" aria-label="Warehouse details tabs">
              {detailsTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`warehouses-page__tab ${detailsTab === tab ? 'is-active' : ''}`}
                  onClick={() => setDetailsTab(tab)}
                  role="tab"
                  aria-selected={detailsTab === tab}
                >
                  {tab}
                </button>
              ))}
            </div>

            {detailsTab === 'Overview' ? (
              <section className="card warehouses-page__layout-card">
                <div className="warehouses-page__section-heading">
                  <div>
                    <h3>Visual Storage Layout</h3>
                    <p>Warehouse contains racks. Racks contain bins. Bins contain product stock.</p>
                  </div>
                </div>

                {isDetailsLoading ? (
                  <div className="warehouses-page__layout-empty">Loading storage layout...</div>
                ) : storageLayout.length === 0 ? (
                  <div className="warehouses-page__layout-empty warehouses-page__layout-empty--action">
                    <strong>No storage structure configured.</strong>
                    <button type="button" className="button button-primary" onClick={openAddRack}>
                      <Plus size={15} />
                      Add Rack
                    </button>
                  </div>
                ) : (
                  <div className="warehouses-page__layout-tree">
                    {storageLayout.map((rack) => (
                      <article className="warehouses-page__layout-rack" key={rack.rackCode}>
                        <h4>{rack.rackCode}</h4>
                        <div className="warehouses-page__layout-rack-meta">
                          <span>{rack.totalBins} bins</span>
                          <span>{rack.totalQuantity} units</span>
                        </div>
                        <div className="warehouses-page__layout-bins">
                          {rack.bins.length === 0 ? (
                            <div className="warehouses-page__layout-bin is-empty">
                              <span>No bins configured</span>
                              <strong>Qty: 0</strong>
                            </div>
                          ) : rack.bins.map((bin) => {
                            const quantity = Number(bin.quantity || 0)
                            const tone = quantity === 0 ? 'empty' : quantity <= 2 ? 'low' : 'active'

                            return (
                              <div className={`warehouses-page__layout-bin is-${tone}`} key={bin.id}>
                                <span>{bin.binCode}</span>
                                <strong>Qty: {quantity}</strong>
                              </div>
                            )
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {detailsTab === 'Racks' ? (
              <section className="card warehouses-page__tab-panel">
                <div className="warehouses-page__section-heading">
                  <div>
                    <h3>Racks</h3>
                    <p>Warehouse contains racks. Add rack codes before creating bins.</p>
                  </div>
                  <button type="button" className="button button-primary" onClick={openAddRack}>
                    <Plus size={15} />
                    Add Rack
                  </button>
                </div>
                {rackRows.length === 0 ? (
                  <div className="warehouses-page__layout-empty warehouses-page__layout-empty--action">
                    <strong>No racks configured.</strong>
                    <button type="button" className="button button-primary" onClick={openAddRack}>
                      <Plus size={15} />
                      Add Rack
                    </button>
                  </div>
                ) : (
                  <DataTable
                    rows={rackRows}
                    columns={rackColumns}
                    keyField="rackId"
                    defaultPageSize={8}
                    searchPlaceholder="Search racks"
                    emptyMessage="No racks configured."
                  />
                )}
              </section>
            ) : null}

            {detailsTab === 'Bins' ? (
              <section className="card warehouses-page__tab-panel">
                <div className="warehouses-page__section-heading">
                  <div>
                    <h3>Bins</h3>
                    <p>Racks contain bins. Bins hold product stock and capacity controls.</p>
                  </div>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={openAddBin}
                    disabled={selectedWarehouseRacks.length === 0}
                    title={selectedWarehouseRacks.length === 0 ? 'Create a rack before adding bins.' : 'Add bin'}
                  >
                    <Plus size={15} />
                    Add Bin
                  </button>
                </div>

                {selectedWarehouseRacks.length === 0 ? (
                  <div className="warehouses-page__layout-empty warehouses-page__layout-empty--action">
                    <strong>Create a rack before adding bins.</strong>
                    <button type="button" className="button button-primary" onClick={openAddRack}>
                      <Plus size={15} />
                      Add Rack
                    </button>
                  </div>
                ) : binRows.length === 0 ? (
                  <div className="warehouses-page__layout-empty warehouses-page__layout-empty--action">
                    <strong>No bins configured.</strong>
                    <button type="button" className="button button-primary" onClick={openAddBin}>
                      <Plus size={15} />
                      Add Bin
                    </button>
                  </div>
                ) : (
                  <DataTable
                    rows={binRows}
                    columns={binColumns}
                    keyField="binId"
                    defaultPageSize={8}
                    searchKeys={['binCode', 'rackCode', 'status']}
                    searchPlaceholder="Search bins"
                    emptyMessage="No bins configured."
                  />
                )}
              </section>
            ) : null}

            {detailsTab === 'Bin Stock' ? (
              <section className="card warehouses-page__tab-panel">
                <div className="warehouses-page__section-heading">
                  <div>
                    <h3>Bin Stock</h3>
                    <p>Stock is stored in bins within racks inside this warehouse.</p>
                  </div>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={openPutawayForm}
                    disabled={selectedWarehouseRacks.length === 0 || selectedWarehouseBins.length === 0 || putawayProductOptions.length === 0}
                    title={
                      selectedWarehouseRacks.length === 0
                        ? 'Create a rack before putaway.'
                        : selectedWarehouseBins.length === 0
                          ? 'Create a bin before putaway.'
                          : putawayProductOptions.length === 0
                            ? 'No unallocated warehouse stock is available.'
                            : 'Putaway stock'
                    }
                  >
                    <Plus size={15} />
                    Putaway Stock
                  </button>
                </div>
                <div className="warehouses-page__stock-summary">
                  <SummaryCard icon={PackageSearch} label="Total Products" value={binStockSummary.products} />
                  <SummaryCard icon={Boxes} label="Total Quantity" value={binStockSummary.quantity} />
                  <SummaryCard icon={WarehouseIcon} label="Occupied Bins" value={binStockSummary.occupiedBins} />
                </div>
                <DataTable
                  rows={selectedWarehouseBinStocks}
                  columns={binStockColumns}
                  keyField="id"
                  defaultPageSize={8}
                  searchKeys={['productName', 'rackCode', 'binCode']}
                  searchPlaceholder="Search product, rack, or bin"
                  emptyMessage="No bin stock found for this warehouse."
                  toolbarContent={(
                    <FilterBar className="warehouses-page__stock-filters">
                      <select value={binStockRackFilter} onChange={(event) => {
                        setBinStockRackFilter(event.target.value)
                        setBinStockBinFilter('all')
                      }} aria-label="Filter bin stock by rack">
                        <option value="all">All racks</option>
                        {selectedWarehouseRacks.map((rack) => (
                          <option key={rack.rackId} value={rack.rackId}>{rack.rackCode}</option>
                        ))}
                      </select>
                      <select value={binStockBinFilter} onChange={(event) => setBinStockBinFilter(event.target.value)} aria-label="Filter bin stock by bin">
                        <option value="all">All bins</option>
                        {selectedWarehouseBins
                          .filter((bin) => binStockRackFilter === 'all' || String(bin.rackId) === String(binStockRackFilter))
                          .map((bin) => (
                            <option key={bin.binId} value={bin.binId}>{bin.binCode}</option>
                          ))}
                      </select>
                      <select value={binStockProductFilter} onChange={(event) => setBinStockProductFilter(event.target.value)} aria-label="Filter bin stock by product">
                        <option value="all">All products</option>
                        {binStockProductOptions.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </FilterBar>
                  )}
                />
              </section>
            ) : null}
          </div>
        </ModalComponent>
      ) : null}

      {rackFormMode ? (
        <FormModal
          title={rackFormMode === 'edit' ? 'Edit Rack' : 'Add Rack'}
          subtitle="Manage rack identifiers inside this warehouse."
          icon={WarehouseIcon}
          dialogClassName="warehouses-page__storage-form-dialog"
          onClose={closeRackForm}
        >
          <form className="warehouses-page__storage-form" onSubmit={handleRackSubmit}>
            <label className="field">
              <span>Rack Code *</span>
              <input
                name="rackCode"
                value={rackForm.rackCode}
                onChange={handleRackFormChange}
                placeholder="RACK-A"
                disabled={isStorageSaving}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                name="description"
                value={rackForm.description}
                onChange={handleRackFormChange}
                placeholder="Primary inbound storage rack"
                rows={3}
                disabled={isStorageSaving}
              />
            </label>
            <div className="button-row warehouses-page__storage-form-footer">
              <button type="button" className="button button-cancel" onClick={closeRackForm} disabled={isStorageSaving}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={isStorageSaving}>
                {isStorageSaving ? 'Saving...' : rackFormMode === 'edit' ? 'Save Rack' : 'Add Rack'}
              </button>
            </div>
          </form>
        </FormModal>
      ) : null}

      {binFormMode ? (
        <FormModal
          title={binFormMode === 'edit' ? 'Edit Bin' : 'Add Bin'}
          subtitle="Configure bin placement, capacity, and status."
          icon={Boxes}
          dialogClassName="warehouses-page__storage-form-dialog"
          onClose={closeBinForm}
        >
          <form className="warehouses-page__storage-form" onSubmit={handleBinSubmit}>
            <label className="field">
              <span>Rack *</span>
              <select
                name="rackId"
                value={binForm.rackId}
                onChange={handleBinFormChange}
                disabled={isStorageSaving || binFormMode === 'edit'}
              >
                <option value="">Select rack</option>
                {selectedWarehouseRacks.map((rack) => (
                  <option key={rack.rackId} value={rack.rackId}>{rack.rackCode}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Bin Code *</span>
              <input
                name="binCode"
                value={binForm.binCode}
                onChange={handleBinFormChange}
                placeholder="BIN-A1"
                disabled={isStorageSaving}
              />
            </label>
            <label className="field">
              <span>Capacity *</span>
              <input
                name="capacity"
                type="number"
                min="1"
                step="1"
                value={binForm.capacity}
                onChange={handleBinFormChange}
                placeholder="10"
                disabled={isStorageSaving}
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                name="status"
                value={binForm.status}
                onChange={handleBinFormChange}
                disabled={isStorageSaving}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className="button-row warehouses-page__storage-form-footer">
              <button type="button" className="button button-cancel" onClick={closeBinForm} disabled={isStorageSaving}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={isStorageSaving}>
                {isStorageSaving ? 'Saving...' : binFormMode === 'edit' ? 'Save Bin' : 'Add Bin'}
              </button>
            </div>
          </form>
        </FormModal>
      ) : null}

      {storagePreview ? (
        <FormModal
          title={storagePreview.title}
          subtitle={storagePreview.type === 'rack' ? 'Rack details' : 'Bin details'}
          icon={storagePreview.type === 'rack' ? WarehouseIcon : Boxes}
          dialogClassName="warehouses-page__preview-dialog"
          onClose={() => setStoragePreview(null)}
        >
          <div className="warehouses-page__preview-grid">
            {storagePreview.fields.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="button-row warehouses-page__confirm-actions">
            <button type="button" className="button button-primary" onClick={() => setStoragePreview(null)}>
              Close
            </button>
          </div>
        </FormModal>
      ) : null}

      {isPutawayOpen ? (
        <FormModal
          title="Putaway Stock"
          subtitle="Allocate received warehouse stock into a rack and bin."
          icon={PackageSearch}
          dialogClassName="warehouses-page__storage-form-dialog"
          onClose={closePutawayForm}
        >
          <form className="warehouses-page__storage-form" onSubmit={handlePutawaySubmit}>
            <label className="field">
              <span>Product *</span>
              <select
                name="productKey"
                value={putawayForm.productKey}
                onChange={handlePutawayFormChange}
                disabled={isPutawaySaving}
              >
                <option value="">Select product</option>
                {putawayProductOptions.map((product) => (
                  <option key={product.key} value={product.key}>
                    {product.productName || `Product ${product.productId}`} - {product.availableQuantity} available
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Warehouse *</span>
              <input
                value={warehouseDetails?.warehouseName || detailsWarehouse?.name || ''}
                disabled
                readOnly
              />
            </label>

            <label className="field">
              <span>Rack *</span>
              <select
                name="rackId"
                value={putawayForm.rackId}
                onChange={handlePutawayFormChange}
                disabled={isPutawaySaving}
              >
                <option value="">Select rack</option>
                {selectedWarehouseRacks.map((rack) => (
                  <option key={rack.rackId} value={rack.rackId}>{rack.rackCode}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Bin *</span>
              <select
                name="binId"
                value={putawayForm.binId}
                onChange={handlePutawayFormChange}
                disabled={isPutawaySaving || !putawayForm.rackId}
              >
                <option value="">Select bin</option>
                {putawayRackBins.map((bin) => (
                  <option key={bin.binId} value={bin.binId}>{bin.binCode}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Quantity *</span>
              <input
                name="quantity"
                type="number"
                min="1"
                step="1"
                value={putawayForm.quantity}
                onChange={handlePutawayFormChange}
                placeholder="Enter quantity"
                disabled={isPutawaySaving}
              />
            </label>

            <div className="warehouses-page__putaway-context">
              <span>Available stock: <strong>{selectedPutawayProduct?.availableQuantity ?? 0}</strong></span>
              <span>
                Remaining bin capacity:{' '}
                <strong>{Number.isFinite(selectedPutawayBinRemaining) ? selectedPutawayBinRemaining : 'Unlimited'}</strong>
              </span>
            </div>

            <div className="button-row warehouses-page__storage-form-footer">
              <button type="button" className="button button-cancel" onClick={closePutawayForm} disabled={isPutawaySaving}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={isPutawaySaving}>
                {isPutawaySaving ? 'Putting away...' : 'Putaway Stock'}
              </button>
            </div>
          </form>
        </FormModal>
      ) : null}

      {confirmAction ? (
        <FormModal
          title={confirmAction.title}
          onClose={() => !isStorageSaving && setConfirmAction(null)}
          dialogClassName="warehouses-page__confirm-dialog"
        >
          <p className="warehouses-page__confirm-message">{confirmAction.message}</p>
          <div className="button-row warehouses-page__confirm-actions">
            <button type="button" className="button button-cancel" onClick={() => setConfirmAction(null)} disabled={isStorageSaving}>
              Cancel
            </button>
            <button type="button" className="button button-danger" onClick={runConfirmAction} disabled={isStorageSaving}>
              {isStorageSaving ? 'Deleting...' : confirmAction.confirmLabel}
            </button>
          </div>
        </FormModal>
      ) : null}

      {isBinTransferOpen ? (
        <ModalComponent
          title="Bin Transfer"
          subtitle="Move product quantity between bins while keeping warehouse stock synchronized."
          onClose={() => setIsBinTransferOpen(false)}
        >
          <div className="card">
            <form className="form-grid form-grid--single" onSubmit={handleBinTransferSubmit}>
              {binTransferErrors.form ? (
                <div className="warehouses-page__inline-error" role="alert">
                  {binTransferErrors.form}
                </div>
              ) : null}

              <SearchableSelect
                id="bin-transfer-product"
                name="productId"
                label="Product"
                icon={Boxes}
                value={binTransferForm.productId}
                onChange={handleBinTransferChange}
                options={products}
                placeholder="Select product"
              />
              {binTransferErrors.productId ? (
                <p className="warehouses-page__field-error">{binTransferErrors.productId}</p>
              ) : null}

              <SearchableSelect
                id="bin-transfer-from"
                name="fromBinId"
                label="Source Bin"
                icon={WarehouseIcon}
                value={binTransferForm.fromBinId}
                onChange={handleBinTransferChange}
                options={sourceBinOptions}
                placeholder="Select source bin"
              />
              {binTransferErrors.fromBinId ? (
                <p className="warehouses-page__field-error">{binTransferErrors.fromBinId}</p>
              ) : null}

              <SearchableSelect
                id="bin-transfer-to"
                name="toBinId"
                label="Destination Bin"
                icon={WarehouseIcon}
                value={binTransferForm.toBinId}
                onChange={handleBinTransferChange}
                options={destinationBinOptions}
                placeholder="Select destination bin"
              />
              {binTransferErrors.toBinId ? (
                <p className="warehouses-page__field-error">{binTransferErrors.toBinId}</p>
              ) : null}
              {selectedDestinationBinOption && destinationBinAvailableCapacity !== null ? (
                <p className="warehouses-page__field-hint">
                  Destination capacity available: {destinationBinAvailableCapacity}
                </p>
              ) : null}

              <QuantityInput
                id="bin-transfer-quantity"
                name="quantity"
                label="Quantity"
                icon={Boxes}
                value={binTransferForm.quantity}
                onChange={handleBinTransferChange}
              />
              {binTransferErrors.quantity ? (
                <p className="warehouses-page__field-error">{binTransferErrors.quantity}</p>
              ) : null}

              <div className="button-row">
                <button className="button button-primary" disabled={isBinTransferSaving}>
                  <ArrowRightLeft size={16} />
                  {isBinTransferSaving ? 'Transferring...' : 'Transfer Bin Stock'}
                </button>
                <button className="button button-cancel"
                  type="button"
                  onClick={() => setIsBinTransferOpen(false)}
                  disabled={isBinTransferSaving}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </ModalComponent>
      ) : null}
    </div>
  )
}




