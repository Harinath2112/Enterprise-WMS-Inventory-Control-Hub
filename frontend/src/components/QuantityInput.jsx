import NumberInput from './NumberInput'

export default function QuantityInput(props) {
  return (
    <NumberInput
      allowDecimal={false}
      allowNegative={false}
      inputMode="numeric"
      {...props}
    />
  )
}
