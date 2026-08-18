export type ParentStatus = 'active' | 'pending';

export interface Parent {
  id: string;
  name: string;
  role: string;
  status: ParentStatus;
  initial: string;
  color: string;
}

export interface Room {
  id: string;
  name: string;
}

export interface Kid {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  birthDate: string;
  roomId: string;
  roomName: string;
  enrollmentDate: string;
  initial: string;
  color: string;
  allergies?: string;
  linkedParents: Parent[];
}

export const rooms: Room[] = [
  { id: 'soles', name: 'Sala Soles' },
  { id: 'lunas', name: 'Sala Lunas' },
];

export const kids: Kid[] = [
  // Sala Soles (8)
  {
    id: 'mateo-fernandez',
    firstName: 'Mateo',
    lastName: 'Fernández',
    age: 3,
    birthDate: '2022-03-12',
    roomId: 'soles',
    roomName: 'Sala Soles',
    enrollmentDate: '2025-02-03',
    initial: 'M',
    color: '#A9D9E8',
    allergies: 'Alergia al maní. Evitar frutos secos. Lleva inhalador en la mochila.',
    linkedParents: [
      {
        id: 'lucia-fernandez',
        name: 'Lucía Fernández',
        role: 'Mamá',
        status: 'active',
        initial: 'L',
        color: '#C9B6E8',
      },
      {
        id: 'diego-fernandez',
        name: 'Diego Fernández',
        role: 'Papá',
        status: 'pending',
        initial: 'D',
        color: '#A9C7E8',
      },
    ],
  },
  {
    id: 'sofia-mendez',
    firstName: 'Sofía',
    lastName: 'Méndez',
    age: 2,
    birthDate: '2023-06-21',
    roomId: 'soles',
    roomName: 'Sala Soles',
    enrollmentDate: '2025-03-10',
    initial: 'S',
    color: '#F4B8CC',
    linkedParents: [
      {
        id: 'mariana-mendez',
        name: 'Mariana Méndez',
        role: 'Mamá',
        status: 'active',
        initial: 'M',
        color: '#B9DEC4',
      },
    ],
  },
  {
    id: 'benjamin-ruiz',
    firstName: 'Benjamín',
    lastName: 'Ruiz',
    age: 3,
    birthDate: '2022-08-05',
    roomId: 'soles',
    roomName: 'Sala Soles',
    enrollmentDate: '2025-01-15',
    initial: 'B',
    color: '#B9DEC4',
    linkedParents: [
      {
        id: 'carolina-ruiz',
        name: 'Carolina Ruiz',
        role: 'Mamá',
        status: 'active',
        initial: 'C',
        color: '#F4B8CC',
      },
      {
        id: 'martin-ruiz',
        name: 'Martín Ruiz',
        role: 'Papá',
        status: 'active',
        initial: 'M',
        color: '#A9D9E8',
      },
    ],
  },
  {
    id: 'valentina-soto',
    firstName: 'Valentina',
    lastName: 'Soto',
    age: 2,
    birthDate: '2023-04-14',
    roomId: 'soles',
    roomName: 'Sala Soles',
    enrollmentDate: '2025-04-01',
    initial: 'V',
    color: '#F4DC8E',
    linkedParents: [],
  },
  {
    id: 'tomas-diaz',
    firstName: 'Tomás',
    lastName: 'Díaz',
    age: 3,
    birthDate: '2022-11-30',
    roomId: 'soles',
    roomName: 'Sala Soles',
    enrollmentDate: '2025-02-20',
    initial: 'T',
    color: '#C9B6E8',
    allergies: 'Intolerancia a la lactosa. Usa leche de almendras.',
    linkedParents: [
      {
        id: 'paula-diaz',
        name: 'Paula Díaz',
        role: 'Mamá',
        status: 'active',
        initial: 'P',
        color: '#F4DC8E',
      },
    ],
  },
  {
    id: 'emma-castro',
    firstName: 'Emma',
    lastName: 'Castro',
    age: 2,
    birthDate: '2023-07-08',
    roomId: 'soles',
    roomName: 'Sala Soles',
    enrollmentDate: '2025-03-25',
    initial: 'E',
    color: '#F4B8CC',
    linkedParents: [
      {
        id: 'vanesa-castro',
        name: 'Vanesa Castro',
        role: 'Mamá',
        status: 'active',
        initial: 'V',
        color: '#C9B6E8',
      },
    ],
  },
  {
    id: 'lucas-romero',
    firstName: 'Lucas',
    lastName: 'Romero',
    age: 3,
    birthDate: '2022-05-19',
    roomId: 'soles',
    roomName: 'Sala Soles',
    enrollmentDate: '2025-01-20',
    initial: 'L',
    color: '#A9D9E8',
    linkedParents: [
      {
        id: 'gabriela-romero',
        name: 'Gabriela Romero',
        role: 'Mamá',
        status: 'active',
        initial: 'G',
        color: '#B9DEC4',
      },
    ],
  },
  {
    id: 'olivia-vega',
    firstName: 'Olivia',
    lastName: 'Vega',
    age: 2,
    birthDate: '2023-02-26',
    roomId: 'soles',
    roomName: 'Sala Soles',
    enrollmentDate: '2025-04-08',
    initial: 'O',
    color: '#B9DEC4',
    linkedParents: [
      {
        id: 'natalia-vega',
        name: 'Natalia Vega',
        role: 'Mamá',
        status: 'pending',
        initial: 'N',
        color: '#F4B8CC',
      },
    ],
  },

  // Sala Lunas (8)
  {
    id: 'julieta-torres',
    firstName: 'Julieta',
    lastName: 'Torres',
    age: 4,
    birthDate: '2021-09-10',
    roomId: 'lunas',
    roomName: 'Sala Lunas',
    enrollmentDate: '2024-03-05',
    initial: 'J',
    color: '#F4B8CC',
    linkedParents: [
      {
        id: 'romina-torres',
        name: 'Romina Torres',
        role: 'Mamá',
        status: 'active',
        initial: 'R',
        color: '#A9D9E8',
      },
    ],
  },
  {
    id: 'felipe-aguirre',
    firstName: 'Felipe',
    lastName: 'Aguirre',
    age: 4,
    birthDate: '2021-12-03',
    roomId: 'lunas',
    roomName: 'Sala Lunas',
    enrollmentDate: '2024-02-18',
    initial: 'F',
    color: '#A9D9E8',
    allergies: 'Alergia al polen. Observar en días de viento.',
    linkedParents: [
      {
        id: 'andres-aguirre',
        name: 'Andrés Aguirre',
        role: 'Papá',
        status: 'active',
        initial: 'A',
        color: '#B9DEC4',
      },
      {
        id: 'daniela-aguirre',
        name: 'Daniela Aguirre',
        role: 'Mamá',
        status: 'active',
        initial: 'D',
        color: '#F4B8CC',
      },
    ],
  },
  {
    id: 'isabella-silva',
    firstName: 'Isabella',
    lastName: 'Silva',
    age: 3,
    birthDate: '2022-10-22',
    roomId: 'lunas',
    roomName: 'Sala Lunas',
    enrollmentDate: '2025-01-08',
    initial: 'I',
    color: '#C9B6E8',
    linkedParents: [
      {
        id: 'camila-silva',
        name: 'Camila Silva',
        role: 'Mamá',
        status: 'active',
        initial: 'C',
        color: '#F4DC8E',
      },
    ],
  },
  {
    id: 'maximiliano-lopez',
    firstName: 'Maximiliano',
    lastName: 'López',
    age: 4,
    birthDate: '2021-06-15',
    roomId: 'lunas',
    roomName: 'Sala Lunas',
    enrollmentDate: '2024-04-12',
    initial: 'M',
    color: '#F4DC8E',
    linkedParents: [
      {
        id: 'roberto-lopez',
        name: 'Roberto López',
        role: 'Papá',
        status: 'pending',
        initial: 'R',
        color: '#A9D9E8',
      },
    ],
  },
  {
    id: 'catalina-munoz',
    firstName: 'Catalina',
    lastName: 'Muñoz',
    age: 3,
    birthDate: '2022-07-30',
    roomId: 'lunas',
    roomName: 'Sala Lunas',
    enrollmentDate: '2025-02-14',
    initial: 'C',
    color: '#B9DEC4',
    linkedParents: [
      {
        id: 'fernanda-munoz',
        name: 'Fernanda Muñoz',
        role: 'Mamá',
        status: 'active',
        initial: 'F',
        color: '#F4B8CC',
      },
      {
        id: 'sebastian-munoz',
        name: 'Sebastián Muñoz',
        role: 'Papá',
        status: 'active',
        initial: 'S',
        color: '#C9B6E8',
      },
    ],
  },
  {
    id: 'sebastian-rojas',
    firstName: 'Sebastián',
    lastName: 'Rojas',
    age: 4,
    birthDate: '2021-11-08',
    roomId: 'lunas',
    roomName: 'Sala Lunas',
    enrollmentDate: '2024-05-20',
    initial: 'S',
    color: '#A9C7E8',
    allergies: 'Alergia a picaduras de insectos. Aplicar repelente.',
    linkedParents: [
      {
        id: 'elena-rojas',
        name: 'Elena Rojas',
        role: 'Mamá',
        status: 'active',
        initial: 'E',
        color: '#B9DEC4',
      },
    ],
  },
  {
    id: 'antonia-perez',
    firstName: 'Antonia',
    lastName: 'Pérez',
    age: 3,
    birthDate: '2022-09-17',
    roomId: 'lunas',
    roomName: 'Sala Lunas',
    enrollmentDate: '2025-01-30',
    initial: 'A',
    color: '#F4B8CC',
    linkedParents: [
      {
        id: 'josefina-perez',
        name: 'Josefina Pérez',
        role: 'Mamá',
        status: 'pending',
        initial: 'J',
        color: '#F4DC8E',
      },
    ],
  },
  {
    id: 'vicente-morales',
    firstName: 'Vicente',
    lastName: 'Morales',
    age: 4,
    birthDate: '2021-08-24',
    roomId: 'lunas',
    roomName: 'Sala Lunas',
    enrollmentDate: '2024-06-10',
    initial: 'V',
    color: '#B9DEC4',
    linkedParents: [
      {
        id: 'pablo-morales',
        name: 'Pablo Morales',
        role: 'Papá',
        status: 'active',
        initial: 'P',
        color: '#A9D9E8',
      },
      {
        id: 'laura-morales',
        name: 'Laura Morales',
        role: 'Mamá',
        status: 'active',
        initial: 'L',
        color: '#F4B8CC',
      },
    ],
  },
];

export const getKidById = (id: string): Kid | undefined => {
  return kids.find((kid) => kid.id === id);
};

const avatarTextColors: Record<string, string> = {
  '#A9D9E8': '#1F7A93',
  '#A9C7E8': '#1F7A93',
  '#F4B8CC': '#C44A7A',
  '#B9DEC4': '#3E8B62',
  '#F4DC8E': '#9A7B1E',
  '#C9B6E8': '#7B5FC0',
};

export const getAvatarTextColor = (backgroundColor: string): string => {
  return avatarTextColors[backgroundColor.toUpperCase()] ?? '#3F362E';
};
