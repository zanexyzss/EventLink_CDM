const badgeVariants = {
  open: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-red-100 text-red-700 border-red-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  sent: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  organizer: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function Badge({ variant = 'draft', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeVariants[variant] || badgeVariants.draft} ${className}`}>
      {children || variant.charAt(0).toUpperCase() + variant.slice(1)}
    </span>
  );
}
