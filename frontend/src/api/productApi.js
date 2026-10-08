import { apiRequest, getResponseData, getResponseList, resolveApiAssetUrl } from './apiClient'
import {
  cachedApiRequest,
  createApiCacheKey,
  hasApiCache,
  invalidateApiCache,
} from './apiCache'
import { API_ENDPOINTS } from './endpoints'
import { isLowStockProduct } from '../utils/helpers'

const DEFAULT_LIST_QUERY = { page: 1, pageSize: 100 }
const CATALOG_CACHE_PREFIX = 'catalog:'

function getCatalogCacheKey(resource, value = 'list') {
  return createApiCacheKey(`${CATALOG_CACHE_PREFIX}${resource}`, value)
}

async function runCatalogMutation(request) {
  const response = await request

  if (response.success) {
    invalidateCatalogCache()
  }

  return response
}

export function invalidateCatalogCache() {
  invalidateApiCache(CATALOG_CACHE_PREFIX)
}

export function getProducts(query = {}, options = {}) {
  const normalizedQuery = {
    ...DEFAULT_LIST_QUERY,
    ...query,
  }

  return cachedApiRequest(
    getCatalogCacheKey('products', normalizedQuery),
    () => apiRequest(API_ENDPOINTS.products.list, { query: normalizedQuery }),
    options,
  )
}

export async function getProductById(id, options = {}) {
  const response = await apiRequest(API_ENDPOINTS.products.byId(id), options)

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: normalizeProduct(getResponseData(response, {})),
  }
}

export function createFullProduct(data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.products.createFull, {
    method: 'POST',
    body: data,
  }))
}

export function updateProduct(id, data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.products.byId(id), {
    method: 'PUT',
    body: data,
  }))
}

export function patchProduct(id, data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.products.byId(id), {
    method: 'PATCH',
    body: data,
  }))
}

export function deleteProduct(id) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.products.byId(id), {
    method: 'DELETE',
  }))
}

export function uploadProductImage(id, file) {
  const formData = new FormData()
  formData.append('file', file)

  return runCatalogMutation(apiRequest(API_ENDPOINTS.products.uploadImage(id), {
    method: 'POST',
    body: formData,
  }))
}

export async function getCategories(options = {}) {
  return cachedApiRequest(getCatalogCacheKey('categories'), async () => {
    const response = await apiRequest(API_ENDPOINTS.categories.list)

    if (!response.success) {
      return response
    }

    const meta = getResponseData(response, {})

    return {
      ...response,
      meta,
      data: getResponseList(response, 'categories').map(normalizeCategory),
    }
  }, options)
}

export function createCategory(data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.categories.create, {
    method: 'POST',
    body: data,
  }))
}

export function createSubCategory(data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.subCategories.list, {
    method: 'POST',
    body: data,
  }))
}

export async function getMainCategories(options = {}) {
  return cachedApiRequest(getCatalogCacheKey('mainCategories'), async () => {
    const response = await apiRequest(API_ENDPOINTS.categories.main)

    if (!response.success) {
      return response
    }

    return {
      ...response,
      data: getResponseList(response, 'categories').map(normalizeCategory),
    }
  }, options)
}

export async function getSubCategories(parentId, options = {}) {
  return cachedApiRequest(getCatalogCacheKey('subCategoriesByParent', parentId || 'all'), async () => {
    const response = await apiRequest(API_ENDPOINTS.categories.sub(parentId))

    if (!response.success) {
      return response
    }

    return {
      ...response,
      data: getResponseList(response, 'subCategories').map(normalizeSubCategory),
    }
  }, options)
}

export async function getSubCategoryRecords(options = {}) {
  return cachedApiRequest(getCatalogCacheKey('subCategories'), async () => {
    const response = await apiRequest(API_ENDPOINTS.subCategories.list, {
      query: DEFAULT_LIST_QUERY,
    })

    if (!response.success) {
      return response
    }

    return {
      ...response,
      data: getResponseList(response, 'subCategories').map(normalizeSubCategory),
    }
  }, options)
}

export async function getProductAttributes(options = {}) {
  return cachedApiRequest(getCatalogCacheKey('productAttributes'), async () => {
    const response = await apiRequest(API_ENDPOINTS.productAttributes.list)

    if (!response.success) {
      return response
    }

    return {
      ...response,
      data: getResponseList(response, 'attributes').map(normalizeAttribute),
    }
  }, options)
}

export async function getAttributeValues(attributeId = '', options = {}) {
  return cachedApiRequest(getCatalogCacheKey('attributeValues', attributeId || 'all'), async () => {
    const response = await apiRequest(
      attributeId
        ? API_ENDPOINTS.attributeValues.byAttribute(attributeId)
        : API_ENDPOINTS.attributeValues.list,
    )

    if (!response.success) {
      return response
    }

    return {
      ...response,
      data: getResponseList(response, 'attributeValues').map(normalizeAttributeValue),
    }
  }, options)
}

export function updateCategory(id, data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.categories.byId(id), {
    method: 'PUT',
    body: data,
  }))
}

export function deleteCategory(id) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.categories.byId(id), {
    method: 'DELETE',
  }))
}

export async function getBrands(options = {}) {
  return cachedApiRequest(getCatalogCacheKey('brands'), async () => {
    const response = await apiRequest(API_ENDPOINTS.brands.list)

    if (!response.success) {
      return response
    }

    return {
      ...response,
      data: getResponseList(response, 'brands').map(normalizeBrand),
    }
  }, options)
}

export function createBrand(data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.brands.create, {
    method: 'POST',
    body: data,
  }))
}

export function updateBrand(id, data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.brands.byId(id), {
    method: 'PUT',
    body: data,
  }))
}

export function deleteBrand(id) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.brands.byId(id), {
    method: 'DELETE',
  }))
}

export async function getUnits(options = {}) {
  return cachedApiRequest(getCatalogCacheKey('units'), async () => {
    const response = await apiRequest(API_ENDPOINTS.units.list)

    if (!response.success) {
      return response
    }

    return {
      ...response,
      data: getResponseList(response, 'units').map(normalizeUnit),
    }
  }, options)
}

export function createUnit(data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.units.create, {
    method: 'POST',
    body: data,
  }))
}

export function getUnitById(id) {
  return apiRequest(API_ENDPOINTS.units.byId(id))
}

export function updateUnit(id, data) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.units.byId(id), {
    method: 'PUT',
    body: data,
  }))
}

export function deleteUnit(id) {
  return runCatalogMutation(apiRequest(API_ENDPOINTS.units.byId(id), {
    method: 'DELETE',
  }))
}

getProducts.hasCache = (query = {}) => hasApiCache(getCatalogCacheKey('products', {
  ...DEFAULT_LIST_QUERY,
  ...query,
}))
getCategories.hasCache = () => hasApiCache(getCatalogCacheKey('categories'))
getMainCategories.hasCache = () => hasApiCache(getCatalogCacheKey('mainCategories'))
getSubCategories.hasCache = (parentId = '') => hasApiCache(getCatalogCacheKey('subCategoriesByParent', parentId || 'all'))
getSubCategoryRecords.hasCache = () => hasApiCache(getCatalogCacheKey('subCategories'))
getProductAttributes.hasCache = () => hasApiCache(getCatalogCacheKey('productAttributes'))
getAttributeValues.hasCache = (attributeId = '') => hasApiCache(getCatalogCacheKey('attributeValues', attributeId || 'all'))
getBrands.hasCache = () => hasApiCache(getCatalogCacheKey('brands'))
getUnits.hasCache = () => hasApiCache(getCatalogCacheKey('units'))

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value)
}

function findReferenceLabel(items, id, fallback = '') {
  const match = items.find((item) => String(item.id) === String(id))
  return match?.label || match?.name || fallback
}

function normalizeStatusLabel(value, fallback = 'Active') {
  const rawValue = String(value ?? '').trim()

  if (!rawValue) {
    return fallback
  }

  return rawValue
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function readBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  const normalizedValue = String(value).trim().toLowerCase()
  if (['true', '1', 'yes'].includes(normalizedValue)) {
    return true
  }

  if (['false', '0', 'no'].includes(normalizedValue)) {
    return false
  }

  return fallback
}

const TITLE_CASE_MINOR_WORDS = new Set([
  'and', 'or', 'nor', 'but', 'a', 'an', 'the', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'per', 'to', 'with', '&',
])

const TITLE_CASE_ACRONYMS = new Set([
  'IT', 'USB', 'LED', 'LCD', 'TV', 'RAM', 'SSD', 'POS', 'CCTV', 'GPS', 'SKU', 'SIM', 'VIP', 'AC', 'DC', 'RO', 'PVC', 'HD', 'FHD', 'UHD', '4K', '5G', '4G', '3G',
])

export function getCanonicalUnitStem(str) {
  if (!str) return ''
  let s = String(str).trim().toLowerCase()
  if (s.endsWith('ies') && s.length > 3) {
    s = s.slice(0, -3) + 'y'
  } else if (s.endsWith('es') && s.length > 3 && (s.endsWith('shes') || s.endsWith('ches') || s.endsWith('boxes') || s.endsWith('xes'))) {
    s = s.slice(0, -2)
  } else if (s.endsWith('s') && !s.endsWith('ss') && s.length > 2) {
    s = s.slice(0, -1)
  }
  return s
}

export function formatUnitTitle(value) {
  if (!value) return ''
  const str = String(value).trim()
  if (!str) return ''

  return str
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return ''
      const upper = word.toUpperCase()
      if (TITLE_CASE_ACRONYMS.has(upper)) return upper
      const lower = word.toLowerCase()
      if (index > 0 && TITLE_CASE_MINOR_WORDS.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

export function normalizeBrand(brand) {
  const id = normalizeId(brand?.id ?? brand?.brandId ?? brand?.BrandId ?? brand?._id)
  const rawName = String(brand?.name ?? brand?.Name ?? '').trim()
  const name = formatUnitTitle(rawName)

  return {
    ...brand,
    id,
    value: id,
    brandId: id,
    name,
    label: name,
    description: String(brand?.description ?? brand?.Description ?? '').trim(),
  }
}

export function normalizeCategory(category) {
  const id = normalizeId(
    category?.id ?? category?.categoryId ?? category?.CategoryId ?? category?._id,
  )
  const parentId = normalizeId(category?.parentId ?? category?.ParentId)
  const rawName = String(category?.name ?? category?.Name ?? '').trim()
  const name = formatUnitTitle(rawName)
  const rawChildSubCategories =
    category?.childSubCategories ??
    category?.ChildSubCategories ??
    category?.subCategories ??
    category?.SubCategories ??
    []
  const childSubCategories = (Array.isArray(rawChildSubCategories) ? rawChildSubCategories : [])
    .map(normalizeSubCategory)
    .filter((item) => item.id && item.name)
  const subcategoryCount = Number(
    category?.subcategoryCount ??
      category?.SubcategoryCount ??
      category?.subCategoryCount ??
      childSubCategories.length,
  )

  return {
    ...category,
    id,
    value: id,
    categoryId: id,
    parentId,
    parentCategoryId: parentId,
    name,
    label: name,
    description: String(category?.description ?? category?.Description ?? '').trim(),
    status: normalizeStatusLabel(category?.status ?? category?.Status, 'Active'),
    subcategoryCount: Number.isFinite(subcategoryCount) ? subcategoryCount : childSubCategories.length,
    childSubCategories,
  }
}

export function normalizeSubCategory(subCategory) {
  const id = normalizeId(
    subCategory?.id ??
      subCategory?.subCategoryId ??
      subCategory?.SubCategoryId ??
      subCategory?._id,
  )
  const categoryId = normalizeId(
    subCategory?.categoryId ?? subCategory?.CategoryId ?? subCategory?.parentId,
  )
  const rawName = String(subCategory?.name ?? subCategory?.Name ?? '').trim()
  const name = formatUnitTitle(rawName)

  return {
    ...subCategory,
    id,
    value: id,
    subCategoryId: id,
    categoryId,
    parentId: categoryId,
    name,
    label: name,
    description: String(subCategory?.description ?? subCategory?.Description ?? '').trim(),
    status: normalizeStatusLabel(subCategory?.status ?? subCategory?.Status, 'Active'),
    createdAt: subCategory?.createdAt ?? subCategory?.CreatedAt ?? '',
    categoryName: subCategory?.categoryName ?? subCategory?.CategoryName ?? '',
  }
}

export function normalizeAttribute(attribute) {
  const id = normalizeId(attribute?.id ?? attribute?.attributeId ?? attribute?.AttributeId)
  const rawName = String(attribute?.name ?? attribute?.Name ?? '').trim()
  const name = formatUnitTitle(rawName)

  return {
    ...attribute,
    id,
    value: id,
    attributeId: id,
    name,
    label: name,
  }
}

export function normalizeAttributeValue(attributeValue) {
  const id = normalizeId(
    attributeValue?.id ?? attributeValue?.valueId ?? attributeValue?.ValueId,
  )
  const attributeId = normalizeId(
    attributeValue?.attributeId ?? attributeValue?.AttributeId,
  )
  const rawValue = String(
    attributeValue?.value ?? attributeValue?.Value ?? attributeValue?.name ?? '',
  ).trim()
  const value = formatUnitTitle(rawValue)

  return {
    ...attributeValue,
    id,
    value: id,
    valueId: id,
    attributeId,
    name: value,
    label: value,
  }
}

export function normalizeUnit(unit) {
  const id = normalizeId(unit?.id ?? unit?.unitId ?? unit?.UnitId ?? unit?._id)
  const rawName = String(unit?.name ?? unit?.Name ?? '').trim()
  const rawShortName = String(
    unit?.shortName ?? unit?.ShortName ?? unit?.abbreviation ?? unit?.Abbreviation ?? '',
  ).trim()

  const name = formatUnitTitle(rawName)
  const shortName = formatUnitTitle(rawShortName)

  return {
    ...unit,
    id,
    value: id,
    unitId: id,
    name,
    label: name,
    shortName,
    abbreviation: shortName,
  }
}

export function normalizeProduct(product, references = {}) {
  const categories = references.categories ?? []
  const brands = references.brands ?? []
  const units = references.units ?? []
  const suppliers = references.suppliers ?? []
  const warehouses = references.warehouses ?? []
  const productId = normalizeId(product?.id ?? product?.productId ?? product?.ProductId ?? product?._id)
  const categoryId = normalizeId(
    product?.categoryId ?? product?.CategoryId ?? product?.category_id,
  )
  const subCategoryId = normalizeId(
    product?.subCategoryId ?? product?.SubCategoryId ?? product?.sub_category_id,
  )
  const brandId = normalizeId(product?.brandId ?? product?.BrandId ?? product?.brand_id)
  const unitId = normalizeId(product?.unitId ?? product?.UnitId ?? product?.unit_id)
  const supplierId = normalizeId(product?.supplierId ?? product?.SupplierId ?? product?.supplier_id)
  const warehouseId = normalizeId(
    product?.warehouseId ?? product?.WarehouseId ?? product?.warehouse_id,
  )
  const stock = Number(product?.stock ?? product?.Stock ?? product?.availableQty ?? 0)
  const reorderLevel = Number(product?.reorderLevel ?? product?.ReorderLevel ?? product?.reorder_level ?? 0)
  const rawStatus = String(product?.status ?? 'active').trim().toLowerCase()
  const isArchived = readBooleanFlag(
    product?.isArchived ??
      product?.IsArchived ??
      product?.is_archived ??
      undefined,
    rawStatus === 'archived',
  )
  const isLowStock = isLowStockProduct({ stock, reorderLevel, status: rawStatus })
  const imageValue =
    product?.image ??
    product?.Image ??
    product?.imageUrl ??
    product?.ImageUrl ??
    product?.imageURL ??
    product?.ImageURL ??
    product?.imagePath ??
    product?.ImagePath ??
    product?.productImage ??
    product?.ProductImage ??
    product?.productImageUrl ??
    product?.ProductImageUrl ??
    product?.thumbnailUrl ??
    product?.ThumbnailUrl ??
    ''
  const imageUrl = resolveApiAssetUrl(imageValue)

  return {
    ...product,
    id: productId,
    productId,
    name: product?.name ?? product?.Name ?? '',
    sku: product?.sku ?? product?.SKU ?? '',
    barcode: product?.barcode ?? product?.Barcode ?? '',
    description: product?.description ?? product?.Description ?? '',
    categoryId,
    category: findReferenceLabel(
      categories,
      categoryId,
      product?.categoryName ?? product?.CategoryName ?? product?.category ?? 'Uncategorized',
    ),
    subCategoryId,
    subCategory:
      product?.subCategoryName ??
      product?.SubCategoryName ??
      product?.subCategory ??
      product?.subcategory ??
      '',
    brandId,
    brand: findReferenceLabel(
      brands,
      brandId,
      product?.brandName ?? product?.BrandName ?? product?.brand ?? 'Generic brand',
    ),
    unitId,
    unit: findReferenceLabel(
      units,
      unitId,
      product?.unitName ?? product?.UnitName ?? product?.unit ?? 'Unit not set',
    ),
    supplierId,
    supplierName: findReferenceLabel(
      suppliers,
      supplierId,
      product?.supplierName ?? product?.SupplierName ?? '',
    ),
    warehouseId,
    warehouseName: findReferenceLabel(
      warehouses,
      warehouseId,
      product?.warehouseName ?? product?.WarehouseName ?? '',
    ),
    price: Number(product?.price ?? product?.Price ?? 0),
    cost: Number(product?.cost ?? product?.costPrice ?? product?.CostPrice ?? 0),
    costPrice: Number(product?.costPrice ?? product?.CostPrice ?? product?.cost ?? 0),
    stock,
    reorderLevel,
    rawStatus,
    sourceStatus: rawStatus,
    isArchived,
    status:
      isArchived
        ? 'Archived'
        : rawStatus === 'inactive'
        ? 'Inactive'
        : stock <= 0
          ? 'Out Of Stock'
          : isLowStock
            ? 'Low Stock'
            : 'In Stock',
    image: imageUrl,
    imageUrl,
    createdAt: product?.createdAt ?? product?.CreatedAt ?? '',
    updatedAt: product?.updatedAt ?? product?.UpdatedAt ?? '',
  }
}

export async function getProductCatalog(query = {}, options = {}) {
  return cachedApiRequest(getCatalogCacheKey('productCatalog', query), async () => {
    const results = await Promise.allSettled([
      getProducts(query, options),
      getCategories(options),
      getBrands(options),
      getUnits(options),
    ])

    const productsResponse = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: results[0].reason?.message || 'Failed to load products' }
    const categoriesResponse = results[1].status === 'fulfilled' ? results[1].value : { success: false, error: results[1].reason?.message || 'Failed to load categories' }
    const brandsResponse = results[2].status === 'fulfilled' ? results[2].value : { success: false, error: results[2].reason?.message || 'Failed to load brands' }
    const unitsResponse = results[3].status === 'fulfilled' ? results[3].value : { success: false, error: results[3].reason?.message || 'Failed to load units' }

    if (!productsResponse.success) {
      return productsResponse
    }

    const categories = categoriesResponse.success
      ? getResponseList(categoriesResponse, 'categories').map(normalizeCategory)
      : []
    const brands = brandsResponse.success
      ? getResponseList(brandsResponse, 'brands').map(normalizeBrand)
      : []
    const units = unitsResponse.success
      ? getResponseList(unitsResponse, 'units').map(normalizeUnit)
      : []
    const products = getResponseList(productsResponse, 'products').map((product) =>
      normalizeProduct(product, { categories, brands, units }),
    )

    return {
      ...productsResponse,
      data: products,
      meta: {
        categories,
        brands,
        units,
      },
    }
  }, options)
}

getProductCatalog.hasCache = (query = {}) => hasApiCache(getCatalogCacheKey('productCatalog', query))

export const normalizeCatalogReferences = {
  categories: (items) => items.map(normalizeCategory).filter((item) => item.id && item.name),
  subCategories: (items) => items.map(normalizeSubCategory).filter((item) => item.id && item.name),
  brands: (items) => items.map(normalizeBrand).filter((item) => item.id && item.name),
  units: (items) => items.map(normalizeUnit).filter((item) => item.id && item.name),
}