// ProductForm.jsx
import {
  Barcode,
  CheckCircle2,
  ChevronDown,
  FileText,
  GitBranch,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CurrencyInput from "../../../../components/CurrencyInput";
import DropdownWithAdd from "../../../../components/DropdownWithAdd";
import InputField from "../../../../components/InputField";
import QuantityInput from "../../../../components/QuantityInput";
import SearchableSelect from "../../../../components/SearchableSelect";
import { validateCategoryName } from "../../../../validators/categoryValidator";
import { validateUnitName } from "../../../../validators/unitValidator";
import { getResponseData, getResponseList, resolveApiAssetUrl } from "../../../../api/apiClient";
import {
  createBrand,
  createCategory,
  createSubCategory,
  createUnit,
  getAttributeValues,
  getBrands,
  getMainCategories,
  getProductAttributes,
  getSubCategoryRecords,
  getUnits,
  normalizeBrand,
  normalizeCategory,
  normalizeSubCategory,
  normalizeUnit,
} from "../../../../api/productApi";
import { getVariantsByProduct } from "../../../../api/productVariantsApi";
import { createId, getNumberError, getRequiredError, getToday } from "../../../../utils/helpers";
import { getStandardSkuError, getStandardizedSku } from "../../../../utils/skuUtils";
import { showToast } from "../../../../components/common/toast";
import './ProductForm.css'

const trackedProductFields = [
  'name',
  'sku',
  'barcode',
  'categoryId',
  'subCategoryId',
  'brandId',
  'unitId',
  'status',
  'costPrice',
  'price',
  'reorderLevel',
  'description',
  'image',
]

const createRequiredFields = [
  'name',
  'categoryId',
  'subCategoryId',
  'brandId',
  'sku',
  'unitId',
  'costPrice',
  'price',
  'description',
]

const defaultCategories = [
  { id: '1', label: 'Electronics' },
  { id: '2', label: 'Furniture' },
  { id: '3', label: 'Accessories' },
]
const defaultSubCategories = [
  { id: '1', categoryId: '1', label: 'Laptops' },
  { id: '2', categoryId: '1', label: 'Mobiles' },
  { id: '3', categoryId: '1', label: 'Accessories' },
  { id: '4', categoryId: '2', label: 'Chairs' },
  { id: '5', categoryId: '2', label: 'Storage' },
  { id: '6', categoryId: '3', label: 'Cables' },
]
const defaultBrands = []
const defaultUnits = []
const defaultAttributes = [
  { id: '1', label: 'Color' },
  { id: '2', label: 'Size' },
  { id: '3', label: 'Material' },
]
const defaultAttributeValues = [
  { id: '1', attributeId: '1', label: 'Black' },
  { id: '2', attributeId: '1', label: 'White' },
  { id: '3', attributeId: '1', label: 'Blue' },
  { id: '4', attributeId: '2', label: 'Small' },
  { id: '5', attributeId: '2', label: 'Medium' },
  { id: '6', attributeId: '2', label: 'Large' },
  { id: '7', attributeId: '3', label: 'Steel' },
  { id: '8', attributeId: '3', label: 'Plastic' },
]

const emptyVariant = {
  id: '',
  variantName: '',
  sku: '',
  priceDelta: '',
  attributeId: '',
  valueId: '',
  attributes: [],
}

const emptyForm = {
  productId: '',
  name: '',
  sku: 'SKU-',
  barcode: '',
  description: '',
  categoryId: '',
  subCategoryId: '',
  brandId: '',
  unitId: '',
  status: 'active',
  costPrice: '',
  price: '',
  reorderLevel: '',
  variantSize: '',
  variantColor: '',
  image: '',
  variants: [],
}

function normalizeString(value) {
  return String(value ?? '').trim()
}

function normalizeNumberForCompare(value) {
  if (value === '' || value === null || value === undefined) {
    return ''
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? String(numberValue) : normalizeString(value)
}

function normalizeFieldForCompare(name, value) {
  if (['costPrice', 'price', 'reorderLevel'].includes(name)) {
    return normalizeNumberForCompare(value)
  }

  return normalizeString(value)
}

function normalizeFieldValue(value) {
  return value === undefined || value === null ? '' : String(value)
}

function generateBarcode() {
  const now = new Date()
  const datePart = getToday().replace(/-/g, '')
  const timePart = [
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ].map((value) => String(value).padStart(2, '0')).join('')
  const millisecondPart = String(now.getMilliseconds()).padStart(3, '0')

  return `BAR-${datePart}-${timePart}${millisecondPart}`
}

function normalizeVariant(variant = {}) {
  const attributeId = variant.attributeId ?? variant.attributes?.[0]?.attributeId ?? ''
  const valueId = variant.valueId ?? variant.value ?? variant.attributes?.[0]?.valueId ?? ''

  return {
    id: normalizeFieldValue(variant.id ?? variant.variantId),
    variantName: normalizeFieldValue(variant.variantName ?? variant.name),
    sku: normalizeFieldValue(variant.sku),
    priceDelta: normalizeFieldValue(variant.priceDelta),
    attributeId: normalizeFieldValue(attributeId),
    valueId: normalizeFieldValue(valueId),
    attributes: Array.isArray(variant.attributes)
      ? variant.attributes.map((attribute) => ({
          attributeId: normalizeFieldValue(attribute.attributeId),
          valueId: normalizeFieldValue(attribute.valueId),
        }))
      : attributeId || valueId
        ? [{ attributeId: normalizeFieldValue(attributeId), valueId: normalizeFieldValue(valueId) }]
        : [],
  }
}

function getVariantSignature(variants = []) {
  return JSON.stringify(
    variants.map((variant) => ({
      id: normalizeFieldValue(variant.id),
      variantName: normalizeString(variant.variantName),
      sku: normalizeString(variant.sku),
      priceDelta: normalizeNumberForCompare(variant.priceDelta),
      attributeId: normalizeFieldValue(variant.attributeId),
      valueId: normalizeFieldValue(variant.valueId),
      attributes: Array.isArray(variant.attributes)
        ? variant.attributes.map((attribute) => ({
            attributeId: normalizeFieldValue(attribute.attributeId),
            valueId: normalizeFieldValue(attribute.valueId),
          }))
        : [],
    })),
  )
}

function normalizeFormValues(values) {
  const normalized = Object.entries(values).reduce((nextValues, [key, value]) => ({
    ...nextValues,
    [key]: value ?? '',
  }), {})

  return {
    ...normalized,
    variants: Array.isArray(values.variants) ? values.variants.map(normalizeVariant) : [],
  }
}

function getInitialForm(initialValues) {
  if (!initialValues) {
    return normalizeFormValues({
      ...emptyForm,
      productId: createId('PRD'),
      sku: 'SKU-',
      barcode: generateBarcode(),
    })
  }

  return normalizeFormValues({
    ...emptyForm,
    sku: initialValues.sku || initialValues.SKU || 'SKU-',
    ...initialValues,
    productId: initialValues.productId ?? initialValues.id ?? createId('PRD'),
    categoryId: initialValues.categoryId ?? '',
    subCategoryId: initialValues.subCategoryId ?? '',
    brandId: initialValues.brandId ?? '',
    unitId: initialValues.unitId ?? '',
    costPrice: initialValues.costPrice ?? initialValues.cost ?? '',
    price: initialValues.price ?? '',
    reorderLevel: initialValues.reorderLevel ?? '',
    variants: Array.isArray(initialValues.variants)
      ? initialValues.variants
      : Array.isArray(initialValues.variantDrafts)
        ? initialValues.variantDrafts
        : [],
    status:
      String(initialValues.status ?? '').toLowerCase() === 'inactive'
        ? 'inactive'
        : 'active',
  })
}

function toOption(item) {
  const id =
    item?.id ??
    item?._id ??
    item?.value ??
    item?.subCategoryId ??
    item?.sub_category_id ??
    item?.SubCategoryId ??
    item?.categoryId ??
    item?.category_id ??
    item?.CategoryId ??
    item?.brandId ??
    item?.brand_id ??
    item?.BrandId ??
    item?.unitId ??
    item?.unit_id ??
    item?.UnitId ??
    item?.attributeId ??
    item?.AttributeId ??
    item?.valueId ??
    item?.ValueId ??
    item?.name
  const label =
    item?.label ??
    item?.name ??
    item?.Name ??
    item?.shortName ??
    item?.ShortName ??
    String(id ?? '')
  return {
    ...item,
    id: String(id),
    value: String(id),
    label: String(label),
  }
}

function getProductEntityId(product) {
  return product?.id ?? product?.productId ?? product?._id ?? ''
}

function getSkuError(value, options = {}) {
  return getStandardSkuError(value, options)
}

function getProductNameError(value) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return 'Product name is required.'
  }

  if (!/^[a-zA-Z0-9 ]+$/.test(normalized)) {
    return 'Product name can only contain alphanumeric characters and spaces.'
  }

  return ''
}

function getProductDescriptionError(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    return 'Description is required.'
  }

  if (text.length < 10) {
    return 'Description must be at least 10 characters long.'
  }

  if (text.length > 500) {
    return 'Description cannot exceed 500 characters.'
  }

  const letterMatches = text.match(/[a-zA-Z]/g)
  if (!letterMatches || letterMatches.length < 5) {
    return 'Description must contain valid text with words, not just special characters or numbers.'
  }

  if (/(.)\1{3,}/i.test(text)) {
    return 'Please enter a valid, meaningful product description.'
  }

  const cleanLetters = text.replace(/[^a-zA-Z]/g, '').toLowerCase()
  if (cleanLetters.length >= 10) {
    const vowelMatches = cleanLetters.match(/[aeiouy]/g)
    const vowelCount = vowelMatches ? vowelMatches.length : 0
    const vowelRatio = vowelCount / cleanLetters.length

    if (vowelRatio < 0.15 || /[bcdfghjklmnpqrstvwxyz]{7,}/i.test(cleanLetters)) {
      return 'Please enter a valid, meaningful product description.'
    }
  }

  return ''
}

function getFieldError(name, value, mode, options = {}) {
  if (name === 'name') {
    return getProductNameError(value)
  }

  if (name === 'description') {
    return getProductDescriptionError(value)
  }

  if (name === 'categoryId') {
    if (!value || value === '' || value === '0') {
      return 'Category is required.'
    }

    const categoryList = options.categories ?? []
    if (categoryList.length > 0) {
      const isValid = categoryList.some((category) => String(category.id) === String(value))
      if (!isValid) {
        return 'Invalid category name. Please select from predefined categories.'
      }
    }

    return ''
  }

  if (name === 'subCategoryId') {
    if (mode === 'create' && (!value || value === '' || value === '0')) {
      return 'Subcategory is required.'
    }

    if (value && value !== '' && value !== '0') {
      const subCategoryList = options.subCategories ?? []
      if (subCategoryList.length > 0) {
        const selectedCategory = options.categoryId
        const isValid = subCategoryList.some(
          (subCat) =>
            String(subCat.id) === String(value) &&
            (!selectedCategory || String(subCat.categoryId ?? subCat.parentId ?? '') === String(selectedCategory)),
        )
        if (!isValid) {
          return 'Please select a valid subcategory for the selected category.'
        }
      }
    }

    return ''
  }

  if (name === 'brandId') {
    if (!value || value === '' || value === '0') {
      return 'Brand is required.'
    }

    const brandList = options.brands ?? []
    if (brandList.length > 0) {
      const isValid = brandList.some((brand) => String(brand.id) === String(value))
      if (!isValid) {
        return 'Please select a valid brand.'
      }
    }

    return ''
  }

  if (name === 'unitId') {
    if (mode === 'create' && (!value || value === '' || value === '0')) {
      return 'Unit is required.'
    }

    const unitList = options.units ?? []
    if (unitList.length > 0 && value && value !== '' && value !== '0') {
      const isValid = unitList.some((unit) => String(unit.id) === String(value))
      if (!isValid) {
        return 'Please select a valid unit.'
      }
    }

    return ''
  }

  if (mode === 'create' && createRequiredFields.includes(name)) {
    const label = {
      categoryId: 'Category',
      subCategoryId: 'Subcategory',
      brandId: 'Brand',
      unitId: 'Unit',
      costPrice: 'Purchase price',
      price: 'Selling price',
      name: 'Product name',
    }[name] ?? name
    const requiredError = getRequiredError(value, label)

    if (requiredError) {
      return requiredError
    }
  }

  if (mode === 'edit' && ['name', 'status'].includes(name)) {
    const label = name === 'name' ? 'Product name' : 'Status'
    const requiredError = getRequiredError(value, label)

    if (requiredError) {
      return requiredError
    }
  }

  if (name === 'sku') {
    return getSkuError(value, {
      products: options.products,
      currentProductId: options.currentProductId,
    })
  }

  if (name === 'price') {
    if (mode === 'create' && (value === '' || value === null || value === undefined)) {
      return 'Selling Price is required.'
    }
    return value === ''
      ? ''
      : getNumberError(value, 'Selling Price (MRP)', { allowZero: false })
  }

  if (name === 'costPrice') {
    if (mode === 'create' && (value === '' || value === null || value === undefined)) {
      return 'Purchase Price is required.'
    }
    return value === ''
      ? ''
      : getNumberError(value, 'Purchase Price', { min: 0, allowZero: true })
  }

  if (name === 'reorderLevel') {
    return value === ''
      ? ''
      : getNumberError(value, 'Reorder level', { min: 0 })
  }

  return ''
}

function FormSection({ title, children, className = '' }) {
  return (
    <section className={`product-form__section ${className}`.trim()}>
      <div className="product-form__section-header">
        <h3>{title}</h3>
      </div>
      <div className="product-form__section-grid">{children}</div>
    </section>
  )
}

export default function ProductForm({
  initialValues,
  modeOverride,
  canSubmit,
  isSaving = false,
  products = [],
  onSubmit,
  onCancel,
}) {
  const mode = modeOverride || (initialValues ? 'edit' : 'create')
  const isEdit = mode === 'edit'
  const [baselineData, setBaselineData] = useState(() => getInitialForm(initialValues))
  const [formData, setFormData] = useState(() => getInitialForm(initialValues))
  const [touched, setTouched] = useState({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [imagePreview, setImagePreview] = useState(() => initialValues?.image ?? '')
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [categories, setCategories] = useState(defaultCategories)
  const [subCategories, setSubCategories] = useState(defaultSubCategories)
  const [brands, setBrands] = useState(defaultBrands)
  const [units, setUnits] = useState(defaultUnits)
  const [attributes, setAttributes] = useState(defaultAttributes)
  const [attributeValues, setAttributeValues] = useState(defaultAttributeValues)
  const [variantDraft, setVariantDraft] = useState(emptyVariant)
  const [barcodeSuccessMessage, setBarcodeSuccessMessage] = useState('')

  useEffect(() => {
    const nextInitialForm = getInitialForm(initialValues)
    setBaselineData(nextInitialForm)
    setFormData(nextInitialForm)
    setTouched({})
    setHasSubmitted(false)
    setImagePreview(initialValues?.image ?? '')
    setSelectedImageFile(null)
    setImageRemoved(false)
    setVariantDraft(emptyVariant)
    setBarcodeSuccessMessage('')
  }, [initialValues])

  useEffect(() => {
    let mounted = true

    async function loadReferenceData() {
      try {
        const [
          categoriesData,
          subCategoriesData,
          brandsData,
          unitsData,
          attributesData,
          attributeValuesData,
        ] = await Promise.all([
          getMainCategories(),
          getSubCategoryRecords(),
          getBrands(),
          getUnits(),
          getProductAttributes(),
          getAttributeValues(),
        ])

        if (!mounted) {
          return
        }

        const categoryList = getResponseList(categoriesData, 'categories')
        const subCategoryList = getResponseList(subCategoriesData, 'subCategories')
        const brandList = getResponseList(brandsData, 'brands')
        const unitList = getResponseList(unitsData, 'units')
        const attributeList = getResponseList(attributesData, 'attributes')
        const attributeValueList = getResponseList(attributeValuesData, 'attributeValues')

        setCategories(
          Array.isArray(categoryList) && categoryList.length > 0
            ? categoryList
                .filter((cat) => {
                  const isInactive = String(cat?.status || cat?.Status || '').toLowerCase() === 'inactive'
                  const isAssigned = isEdit && String(cat?.id || cat?.categoryId) === String(formData.categoryId)
                  return !isInactive || isAssigned
                })
                .map(toOption)
            : defaultCategories,
        )
        setSubCategories(
          Array.isArray(subCategoryList) && subCategoryList.length > 0
            ? subCategoryList.map(toOption)
            : defaultSubCategories,
        )
        setBrands(Array.isArray(brandList) ? brandList.map(toOption) : [])
        setUnits(Array.isArray(unitList) ? unitList.map(toOption) : [])
        setAttributes(
          Array.isArray(attributeList) && attributeList.length > 0
            ? attributeList.map(toOption)
            : defaultAttributes,
        )
        setAttributeValues(
          Array.isArray(attributeValueList) && attributeValueList.length > 0
            ? attributeValueList.map(toOption)
            : defaultAttributeValues,
        )
      } catch {
        if (!mounted) {
          return
        }

        setCategories(defaultCategories)
        setSubCategories(defaultSubCategories)
        setBrands(defaultBrands)
        setUnits(defaultUnits)
        setAttributes(defaultAttributes)
        setAttributeValues(defaultAttributeValues)
      }
    }

    loadReferenceData()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadVariantDrafts() {
      if (mode !== 'edit') {
        return
      }

      const productId = getProductEntityId(initialValues)

      if (!productId) {
        return
      }

      try {
        const variantsResponse = await getVariantsByProduct(productId)
        const variants = getResponseList(variantsResponse, 'variants')

        if (!variantsResponse.success) {
          throw new Error(variantsResponse.error || 'Failed to load variants')
        }

        const drafts = Array.isArray(variants) ? variants.map(normalizeVariant) : []

        if (!mounted) {
          return
        }

        setFormData((currentValue) => ({
          ...currentValue,
          variants: drafts,
        }))
        setBaselineData((currentValue) => ({
          ...currentValue,
          variants: drafts,
        }))
      } catch {
        if (!mounted) {
          return
        }
      }
    }

    loadVariantDrafts()

    return () => {
      mounted = false
    }
  }, [initialValues, mode])

  const changedFields = useMemo(() => {
    if (!isEdit) {
      return trackedProductFields
    }

    return trackedProductFields.filter(
      (field) =>
        normalizeFieldForCompare(field, formData[field]) !==
        normalizeFieldForCompare(field, baselineData[field]),
    )
  }, [baselineData, formData, isEdit])

  const changedFieldSet = useMemo(() => new Set(changedFields), [changedFields])
  const variantsChanged = useMemo(
    () => getVariantSignature(formData.variants) !== getVariantSignature(baselineData.variants),
    [baselineData.variants, formData.variants],
  )
  const filteredSubCategories = useMemo(
    () =>
      subCategories.filter(
        (item) => String(item.categoryId ?? item.parentId ?? '') === String(formData.categoryId),
      ),
    [formData.categoryId, subCategories],
  )
  const filteredAttributeValues = useMemo(
    () =>
      attributeValues.filter(
        (item) => String(item.attributeId ?? '') === String(variantDraft.attributeId),
      ),
    [attributeValues, variantDraft.attributeId],
  )

  useEffect(() => {
    if (
      formData.subCategoryId &&
      !filteredSubCategories.some((item) => String(item.id) === String(formData.subCategoryId))
    ) {
      setFormData((currentValue) => ({
        ...currentValue,
        subCategoryId: '',
      }))
    }
  }, [filteredSubCategories, formData.subCategoryId])

  const errors = useMemo(() => {
    const fieldsToValidate = Array.from(
      new Set(
        isEdit
          ? [...changedFields, 'categoryId', 'subCategoryId', 'brandId', 'sku', 'unitId', 'costPrice', 'price', 'description']
          : [...createRequiredFields, 'categoryId', 'subCategoryId', 'brandId', 'sku', 'unitId', 'costPrice', 'price', 'description'],
      ),
    )

    return fieldsToValidate.reduce((nextErrors, field) => {
      const error = getFieldError(field, formData[field], mode, {
        categories,
        subCategories,
        brands,
        units,
        categoryId: formData.categoryId,
        products,
        currentProductId: getProductEntityId(initialValues),
      })
      return error ? { ...nextErrors, [field]: error } : nextErrors
    }, {})
  }, [changedFields, categories, subCategories, brands, units, formData, isEdit, mode, products, initialValues])

  const hasChanges = isEdit
    ? changedFields.length > 0 || variantsChanged || selectedImageFile !== null || imageRemoved
    : true
  const isFormValid = Object.keys(errors).length === 0
  const canSave = canSubmit && hasChanges && isFormValid && !isSaving
  const changedCount =
    changedFields.length +
    (variantsChanged ? 1 : 0) +
    (selectedImageFile !== null || imageRemoved ? 1 : 0)

  async function handleAddCategory(draft) {
    const label = normalizeString(draft?.name)
    if (!label) {
      showToast('Category name is required.', 'error')
      return null
    }

    const validationError = validateCategoryName(label, categories)
    if (validationError) {
      showToast(validationError, 'error')
      return null
    }

    try {
      const response = await createCategory({ name: label })
      if (!response.success) {
        throw new Error(response.error || 'Failed to create category')
      }

      const createdCategory = typeof normalizeCategory === 'function'
        ? normalizeCategory(response.data)
        : (response.data || {})
      const createdId = String(createdCategory?.id || createdCategory?.categoryId || '')

      await refreshFormOptions()
      setFormData((currentValue) => ({
        ...currentValue,
        categoryId: createdId,
        subCategoryId: '',
      }))

      showToast('Category created successfully.', 'success')
      return toOption(createdCategory)
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : 'Failed to create category'
      const msg = /normalizeCategory|is not defined|referenceerror|typeerror|failed to fetch/i.test(rawMsg)
        ? 'Invalid category name. Please select from predefined categories.'
        : rawMsg
      showToast(msg, 'error')
      return null
    }
  }

  async function handleAddSubCategory(draft) {
    const label = normalizeString(draft?.name)

    if (!label) {
      showToast('Subcategory name is required.', 'error')
      return null
    }

    if (!formData.categoryId) {
      showToast('Please select a category before adding a subcategory.', 'error')
      return null
    }

    // Validate the subcategory name — reuse the same rules as category names
    const validationError = validateCategoryName(label, subCategories)
    if (validationError) {
      // Rephrase the generic category error message for subcategory context
      const subCatError = validationError
        .replace(/category/gi, 'subcategory')
        .replace(/categories/gi, 'subcategories')
      showToast(subCatError, 'error')
      return null
    }

    try {
      const response = await createSubCategory({
        name: label,
        categoryId: Number(formData.categoryId),
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to create subcategory')
      }

      const createdSubCat = normalizeSubCategory(response.data)
      const createdId = String(createdSubCat.id)

      await refreshFormOptions()
      setFormData((currentValue) => ({
        ...currentValue,
        subCategoryId: createdId,
      }))

      showToast('Subcategory created successfully.', 'success')
      return toOption(createdSubCat)
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : 'Failed to create subcategory'
      // Sanitize raw JS / network errors — never expose internal error details
      const msg = /normalizeCategory|normalizeSubCategory|is not defined|referenceerror|typeerror|failed to fetch/i.test(rawMsg)
        ? 'Invalid subcategory name. Please select from predefined subcategories.'
        : rawMsg
      showToast(msg, 'error')
      return null
    }
  }

  async function handleAddBrand(draft) {
    const label = normalizeString(draft?.name)
    if (!label) {
      showToast('Brand name is required.', 'error')
      return null
    }

    if (!/^[A-Za-z0-9\s&.-]+$/.test(label)) {
      showToast('Invalid brand name. Please enter a valid brand name (letters, numbers, spaces, &, ., -).', 'error')
      return null
    }

    try {
      const response = await createBrand({ name: label })

      if (!response.success) {
        throw new Error(response.error || 'Failed to create brand')
      }

      const createdBrand = normalizeBrand(response.data)
      const createdId = String(createdBrand.id)

      await refreshFormOptions()
      setFormData((currentValue) => ({
        ...currentValue,
        brandId: createdId,
      }))

      showToast('Brand created successfully.', 'success')
      return toOption(createdBrand)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create brand'
      showToast(msg, 'error')
      return null
    }
  }

  async function handleAddUnit(draft) {
    const label = normalizeString(draft?.name)
    const err = validateUnitName(label, options.units)
    if (err) {
      showToast(err, 'error')
      return null
    }

    try {
      const response = await createUnit({ name: label, shortName: label })

      if (!response.success) {
        throw new Error(response.error || 'Failed to create unit')
      }

      const createdUnit = normalizeUnit(response.data)
      const createdId = String(createdUnit.id)

      await refreshFormOptions()
      setFormData((currentValue) => ({
        ...currentValue,
        unitId: createdId,
      }))

      showToast('Unit created successfully.', 'success')
      return toOption(createdUnit)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create unit'
      showToast(msg, 'error')
      return null
    }
  }

  function shouldShowError(name) {
    if (!errors[name]) {
      return false
    }

    return isEdit ? (changedFieldSet.has(name) || touched[name] || hasSubmitted) : (touched[name] || hasSubmitted)
  }

  function handleChange(event) {
    const { name, value } = event.target

    let nextValue = value

    if (name === 'barcode') {
      setBarcodeSuccessMessage('')
    }

    if (name === 'sku') {
      const trimmed = value.trim()
      if (/^\d+$/.test(trimmed)) {
        nextValue = `SKU-${trimmed}`
      } else {
        nextValue = value.toUpperCase()
      }
    }

    setFormData((currentValue) => ({
      ...currentValue,
      [name]: nextValue,
      ...(name === 'categoryId' ? { subCategoryId: '' } : {}),
    }))
    setTouched((currentValue) => ({
      ...currentValue,
      [name]: true,
      ...(name === 'categoryId' ? { subCategoryId: true } : {}),
    }))
  }

  function handleBlur(event) {
    setTouched((currentValue) => ({
      ...currentValue,
      [event.target.name]: true,
    }))
  }

  function handleImageFile(file) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const nextImage = String(reader.result ?? '')
      setImagePreview(nextImage)
      setSelectedImageFile(file)
      setImageRemoved(false)
      setFormData((currentValue) => ({
        ...currentValue,
        image: `selected:${file.name}:${file.size}:${file.lastModified}`,
      }))
      setTouched((currentValue) => ({
        ...currentValue,
        image: true,
      }))
    }

    reader.readAsDataURL(file)
  }

  function handleImageChange(event) {
    const [file] = event.target.files ?? []
    handleImageFile(file)
    event.target.value = ''
  }

  function handleImageDrop(event) {
    event.preventDefault()
    const [file] = event.dataTransfer.files ?? []
    handleImageFile(file)
  }

  function handleImageDragOver(event) {
    event.preventDefault()
  }

  function handleRemoveImage() {
    setSelectedImageFile(null)
    setImageRemoved(true)
    setImagePreview('')
    setFormData((currentValue) => ({
      ...currentValue,
      image: '',
    }))
    setTouched((currentValue) => ({
      ...currentValue,
      image: true,
    }))
  }

  function handleVariantDraftChange(event) {
    const { name, value } = event.target
    setVariantDraft((current) => ({
      ...current,
      [name]: value,
      ...(name === 'attributeId' ? { valueId: '' } : {}),
    }))
  }

  function handleAddVariantDraft() {
    if (!normalizeString(variantDraft.variantName)) {
      return
    }

    const baseParentSku = getStandardizedSku(formData.sku, formData)
    const fallbackVariantSku = baseParentSku && baseParentSku !== '—'
      ? `${baseParentSku}-VAR-${String(formData.variants.length + 1).padStart(2, '0')}`
      : ''

    const nextDraft = normalizeVariant({
      ...variantDraft,
      id: variantDraft.id || createId('VRN'),
      variantName: normalizeString(variantDraft.variantName),
      sku: normalizeString(variantDraft.sku) || fallbackVariantSku,
      priceDelta: variantDraft.priceDelta || '0',
      attributes: variantDraft.attributeId && variantDraft.valueId
        ? [{ attributeId: variantDraft.attributeId, valueId: variantDraft.valueId }]
        : [],
    })

    setFormData((current) => {
      const existingIndex = current.variants.findIndex((item) => item.id === nextDraft.id)
      if (existingIndex >= 0) {
        const nextDrafts = [...current.variants]
        nextDrafts[existingIndex] = nextDraft
        return { ...current, variants: nextDrafts }
      }

      return {
        ...current,
        variants: [...current.variants, nextDraft],
      }
    })

    setVariantDraft(emptyVariant)
  }

  function handleEditVariantDraft(item) {
    setVariantDraft(item)
  }

  function handleDeleteVariantDraft(id) {
    setFormData((current) => ({
      ...current,
      variants: current.variants.filter((item) => item.id !== id),
    }))
  }

  function handleStatusToggle(event) {
    const nextStatus = event.target.checked ? 'active' : 'inactive'
    setFormData((currentValue) => ({
      ...currentValue,
      status: nextStatus,
    }))
    setTouched((currentValue) => ({
      ...currentValue,
      status: true,
    }))
  }

  function handleGenerateBarcode() {
    try {
      const nextBarcode = generateBarcode()

      if (!nextBarcode) {
        throw new Error('Failed to generate barcode.')
      }

      setFormData((currentValue) => ({
        ...currentValue,
        barcode: nextBarcode,
      }))
      setTouched((currentValue) => ({
        ...currentValue,
        barcode: true,
      }))
      setBarcodeSuccessMessage('Barcode generated successfully.')

      showToast('Barcode generated successfully.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate barcode.'
      setBarcodeSuccessMessage('')
      showToast(message, 'error')
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    setHasSubmitted(true)

    if (!isFormValid || !hasChanges) {
      return
    }

    const values = {
      ...formData,
      barcode: normalizeString(formData.barcode) || generateBarcode(),
      image: imageRemoved ? '' : selectedImageFile ? '' : formData.image || imagePreview,
      imageFile: selectedImageFile,
      imageRemoved,
    }

    onSubmit?.({
      values,
      changedFields,
      variantsChanged,
      mode,
    })
  }

  function handleCancel() {
    if (isEdit) {
      onCancel()
      return
    }

    const nextForm = getInitialForm()
    setBaselineData(nextForm)
    setFormData(nextForm)
    setTouched({})
    setHasSubmitted(false)
    setImagePreview('')
    setSelectedImageFile(null)
    setImageRemoved(false)
    setVariantDraft(emptyVariant)
    setBarcodeSuccessMessage('')
  }

  const actionLabel = isSaving
    ? 'Saving...'
    : isEdit
      ? changedCount > 0
        ? `Save ${changedCount} change${changedCount === 1 ? '' : 's'}`
        : 'No changes'
      : 'Create product'

  return (
    <div className={`product-form ${isEdit ? 'product-form--edit' : 'product-form--create'}`}>
      <form onSubmit={handleSubmit} autoComplete="off">
        {isEdit ? (
          <div className="product-form__edit-strip">
            <div>
              <span className="product-form__eyebrow">Editing</span>
              <strong>{formData.name || 'Product'}</strong>
            </div>
            <span className={`product-form__dirty-pill ${hasChanges ? 'is-dirty' : ''}`}>
              {hasChanges ? `${changedCount} pending` : 'Saved'}
            </span>
          </div>
        ) : null}

        {isEdit ? (
          <FormSection title="Quick Updates" className="product-form__section--priority">
            <CurrencyInput
              id="price"
              name="price"
              label="Selling Price (MRP) *"
              style={{ textAlign: 'right' }}
              value={formData.price || ''}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter selling price in INR"
              error={shouldShowError('price') ? errors.price : ''}
            />
            <CurrencyInput
              id="costPrice"
              name="costPrice"
              label="Purchase Price *"
              style={{ textAlign: 'right' }}
              value={formData.costPrice || ''}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter purchase price in INR"
              error={shouldShowError('costPrice') ? errors.costPrice : ''}
            />
            <QuantityInput
              id="reorderLevel"
              name="reorderLevel"
              label="Reorder Level"
              style={{ textAlign: 'left' }}
              value={formData.reorderLevel || ''}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Minimum level"
              error={shouldShowError('reorderLevel') ? errors.reorderLevel : ''}
            />
            <label className="product-form__switch">
              <input
                type="checkbox"
                checked={formData.status !== 'inactive'}
                onChange={handleStatusToggle}
              />
              <span>Active</span>
            </label>
          </FormSection>
        ) : null}

        <FormSection title="Basic Information">
          <DropdownWithAdd
            id="category"
            name="categoryId"
            label="Category *"
            value={formData.categoryId || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            options={categories}
            placeholder="Select category"
            error={errors.categoryId}
            showError={shouldShowError('categoryId')}
            onAddOption={handleAddCategory}
            addLabel="+ Add"
            addTitle="Add Category"
            addFields={[
              {
                name: 'name',
                label: 'Category Name',
                placeholder: 'Enter category name',
              },
            ]}
          />
          <DropdownWithAdd
            id="subCategoryId"
            name="subCategoryId"
            label="SubCategory *"
            value={formData.subCategoryId || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            options={filteredSubCategories}
            placeholder={
              formData.categoryId ? 'Select subcategory' : 'Select category first'
            }
            disabled={!formData.categoryId}
            error={errors.subCategoryId}
            showError={shouldShowError('subCategoryId')}
            onAddOption={handleAddSubCategory}
            addLabel="+ Add"
            addTitle="Add SubCategory"
            addFields={[
              {
                name: 'name',
                label: 'SubCategory Name',
                placeholder: 'Enter subcategory name',
              },
            ]}
          />
          <DropdownWithAdd
            id="brand"
            name="brandId"
            label="Brand *"
            value={formData.brandId || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            options={brands}
            placeholder="Select brand"
            error={errors.brandId}
            showError={shouldShowError('brandId')}
            onAddOption={handleAddBrand}
            addLabel="+ Add"
            addTitle="Add Brand"
            addFields={[
              {
                name: 'name',
                label: 'Brand Name',
                placeholder: 'Enter brand name',
              },
            ]}
          />
          <InputField
            id="name"
            name="name"
            label="Product Name *"
            value={formData.name || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter product name"
            error={shouldShowError('name') ? errors.name : ''}
          />
          <InputField
            id="sku"
            name="sku"
            label="SKU *"
            value={formData.sku || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            placeholder="e.g. SD-DAP-20230947"
            error={shouldShowError('sku') ? errors.sku : ''}
          />
          <div className="product-form__barcode-field">
            <div className="product-form__barcode-input-wrap">
              <InputField
                id="barcode"
                name="barcode"
                label="Barcode *"
                value={formData.barcode || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter barcode value"
                error={shouldShowError('barcode') ? errors.barcode : ''}
              />
              {barcodeSuccessMessage && !errors.barcode ? (
                <span className="product-form__barcode-success" role="status">
                  <CheckCircle2 size={13} />
                  {barcodeSuccessMessage}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="button product-form__generate-button"
              onClick={handleGenerateBarcode}
              title="Generate a unique barcode"
            >
              <Barcode size={16} />
              Generate
            </button>
          </div>
          <DropdownWithAdd
            id="unit"
            name="unitId"
            label="Unit *"
            value={formData.unitId || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            options={units}
            placeholder="Select unit"
            error={errors.unitId}
            showError={shouldShowError('unitId')}
            onAddOption={handleAddUnit}
            addLabel="+ Add"
            addTitle="Add Unit"
            addFields={[
              {
                name: 'name',
                label: 'Unit Name',
                placeholder: 'Enter unit name',
              },
            ]}
          />
          <CurrencyInput
            id="costPrice"
            name="costPrice"
            label="Purchase Price *"
            style={{ textAlign: 'right' }}
            value={formData.costPrice || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter purchase price in INR"
            error={shouldShowError('costPrice') ? errors.costPrice : ''}
          />
          <CurrencyInput
            id="price"
            name="price"
            label="Selling Price (MRP) *"
            style={{ textAlign: 'right' }}
            value={formData.price || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter selling price in INR"
            error={shouldShowError('price') ? errors.price : ''}
          />
          <QuantityInput
            id="reorderLevel"
            name="reorderLevel"
            label="Reorder Level"
            style={{ textAlign: 'left' }}
            value={formData.reorderLevel || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Minimum reorder level"
            error={shouldShowError('reorderLevel') ? errors.reorderLevel : ''}
          />
          <InputField
            id="variantSize"
            name="variantSize"
            label="Size / Specification"
            value={formData.variantSize || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Example: XL, 5mm, 32GB"
          />
          <InputField
            id="variantColor"
            name="variantColor"
            label="Attribute"
            value={formData.variantColor || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Example: Black, Blue, Natural"
          />
          <InputField
            id="description"
            name="description"
            label="Description *"
            textarea
            rows={2}
            className="field--full product-form__description-field"
            value={formData.description || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Add a detailed product description (minimum 10 characters)"
            error={shouldShowError('description') ? errors.description : ''}
          />
          <label className="product-form__switch field--full">
            <input
              type="checkbox"
              checked={formData.status !== 'inactive'}
              onChange={handleStatusToggle}
            />
            <span>Active</span>
          </label>

          <div className="field--full product-form__inline-variants">
            <div className="product-form__inline-variants-header">
              <h4>Product Variants</h4>
            </div>
            <div className="product-form__section-grid product-form__variant-builder">
              <InputField
                id="variant-name"
                name="variantName"
                label="Variant Name"
                value={variantDraft.variantName || ''}
                onChange={handleVariantDraftChange}
                placeholder="Example: 16GB / Black"
              />
              <InputField
                id="variant-sku"
                name="sku"
                label="Variant SKU"
                value={variantDraft.sku || ''}
                onChange={handleVariantDraftChange}
                placeholder="e.g. SD-DAP-20230947-VAR-01"
              />
              <SearchableSelect
                id="variant-attribute-id"
                name="attributeId"
                label="Attribute"
                value={variantDraft.attributeId || ''}
                onChange={handleVariantDraftChange}
                onBlur={handleBlur}
                options={attributes}
                placeholder="Select attribute"
              />
              <SearchableSelect
                id="variant-attribute-value"
                name="valueId"
                label="Attribute Value"
                value={variantDraft.valueId || ''}
                onChange={handleVariantDraftChange}
                onBlur={handleBlur}
                options={filteredAttributeValues}
                placeholder={
                  variantDraft.attributeId ? 'Select value' : 'Select attribute first'
                }
                disabled={!variantDraft.attributeId}
              />
              <CurrencyInput
                id="variant-price-delta"
                name="priceDelta"
                label="Price Delta"
                value={variantDraft.priceDelta || ''}
                onChange={handleVariantDraftChange}
                placeholder="0"
              />
              <div className="button-row field--full">
                <button type="button" className="button button-primary" onClick={handleAddVariantDraft}>
                  {variantDraft.id ? 'Update Variant' : 'Add Variant'}
                </button>
              </div>
            </div>

            {formData.variants.length > 0 ? (
              <div className="product-form__variant-list">
                {formData.variants.map((item, index) => {
                  const attributeLabel =
                    attributes.find((attr) => String(attr.id) === String(item.attributeId))?.label ||
                    'Standard'
                  const valueLabel =
                    attributeValues.find((value) => String(value.id) === String(item.valueId))?.label ||
                    '-'

                  return (
                    <article
                      className="product-form__variant-card"
                      key={item.id || `${item.variantName}-${item.sku}-${index}`}
                    >
                      <div>
                        <strong>{item.variantName}</strong>
                        <span>{item.sku || 'SKU follows product'}</span>
                      </div>
                      <div>
                        <span>{attributeLabel}</span>
                        <strong>{valueLabel}</strong>
                      </div>
                      <div className="product-form__variant-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleEditVariantDraft(item)}
                          aria-label={`Edit ${item.variantName}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn text-red-600"
                          onClick={() => handleDeleteVariantDraft(item.id)}
                          aria-label={`Delete ${item.variantName}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="product-form__empty-note">No variants added. The product will use a default sellable variant.</p>
            )}
          </div>

          <div className="field field--full product-form__media-field">
            <label htmlFor="image-upload">Product Image</label>
            <div
              className="product-form__image-dropzone"
              onDrop={handleImageDrop}
              onDragOver={handleImageDragOver}
            >
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              <label className="product-form__image-preview" htmlFor="image-upload" title={imagePreview ? "Click to change image" : "Click to upload image"}>
                {imagePreview ? (
                  <img
                    src={resolveApiAssetUrl(imagePreview)}
                    alt="Product preview"
                    onError={() => {
                      setImagePreview('')
                    }}
                  />
                ) : (
                  <div className="product-form__image-empty">
                    <ImagePlus size={32} className="product-form__image-empty-icon" />
                    <strong>Add Product Image</strong>
                    <span>Drag & drop image here, or click to browse</span>
                    <small>PNG, JPG, or WebP preview</small>
                  </div>
                )}
              </label>
              <div className="product-form__image-actions">
                <label
                  className="button product-form__upload-button"
                  htmlFor="image-upload"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      document.getElementById('image-upload')?.click()
                    }
                  }}
                >
                  <ImagePlus size={16} />
                  {imagePreview ? 'Change Image' : 'Upload Image'}
                </label>
                {imagePreview ? (
                  <button
                    type="button"
                    className="button product-form__remove-image-button"
                    onClick={handleRemoveImage}
                  >
                    <Trash2 size={16} />
                    Remove Image
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </FormSection>

        <div className="product-form__footer">
          <button
            type="submit"
            className="button button-primary"
            disabled={!canSave}
          >
            <Save size={16} />
            {actionLabel}
          </button>
          <button type="button" className="button button-secondary button-cancel" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
