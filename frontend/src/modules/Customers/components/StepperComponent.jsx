export default function StepperComponent({ steps, activeStep, onChange }) {
  return (
    <div className="customers-stepper">
      {steps.map((step, index) => {
        const stepIndex = index + 1
        const isActive = stepIndex === activeStep
        const isCompleted = stepIndex < activeStep

        return (
          <button
            key={step}
            type="button"
            className={`stepper-step ${isActive ? 'stepper-step--active' : ''} ${isCompleted ? 'stepper-step--completed' : ''
              }`}
            onClick={() => onChange(stepIndex)}
          >
            <span className="stepper-step__number">{stepIndex}</span>
            <span>
              <strong>{step}</strong>
            </span>
          </button>
        )
      })}
    </div>
  )
}
