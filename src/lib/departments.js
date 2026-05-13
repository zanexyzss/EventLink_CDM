// CDM Institutes and Programs - Shared Constants
export const CDM_DEPARTMENTS = [
  {
    institute: 'Institute of Teacher Education',
    programs: [
      'BECEd - Bachelor of Early Childhood Education',
      'BTLEd ICT - Bachelor of Technology and Livelihood Education Major in ICT',
      'BSEd Sci - Bachelor of Secondary Education Major in Science',
      'BEEd Gen - Bachelor of Elementary Education Major in General Education',
      'TCP - Teacher Certificate Program',
    ],
  },
  {
    institute: 'Institute of Computing Studies',
    programs: [
      'BSCpE - BS in Computer Engineering',
      'BSIT - BS in Information Technology',
    ],
  },
  {
    institute: 'Institute of Business and Entrepreneurship',
    programs: [
      'BS Entrep - BS in Entrepreneurship',
      'BSBA HRM - BS in Business Administration Major in Human Resource Management',
    ],
  },
];

// Flat list for simple selects
export const ALL_PROGRAMS = CDM_DEPARTMENTS.flatMap(d => d.programs);
