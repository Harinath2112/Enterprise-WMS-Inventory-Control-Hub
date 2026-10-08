export function normalizeSelectOptions(options = []) {
  return (Array.isArray(options) ? options : []).map((option) => {
    if (typeof option === 'string') {
      return {
        value: option,
        label: option,
      }
    }

    if (!option || typeof option !== 'object') {
      return {
        value: '',
        label: '',
      }
    }

    const value =
      option.value ??
      option.id ??
      option.productId ??
      option.ProductId ??
      option.categoryId ??
      option.CategoryId ??
      option.brandId ??
      option.BrandId ??
      option.unitId ??
      option.UnitId ??
      option.supplierId ??
      option.SupplierId ??
      option.warehouseId ??
      option.WarehouseId ??
      option.name ??
      option.Name ??
      ''
    const label =
      option.label ??
      option.name ??
      option.Name ??
      option.shortName ??
      option.ShortName ??
      option.contact ??
      option.Contact ??
      option.value ??
      ''

    return {
      value: value === undefined || value === null ? '' : String(value),
      label: label === undefined || label === null ? '' : String(label),
    }
  }).filter((option) => option.value !== '' || option.label !== '')
}

export function getSelectedOption(options, value) {
  const selectedValue = typeof value === 'object' && value !== null
    ? value.value ?? value.label ?? value.name ?? value.Name ?? ''
    : value

  return options.find((option) => String(option.value) === String(selectedValue)) ?? null
}
