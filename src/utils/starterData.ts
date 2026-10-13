import { Activity } from '../types';

export const STARTER_ACTIVITIES: Omit<Activity, 'created_at' | 'updated_at'>[] = [
  {
    activity_id: 'act_beard_cut',
    name: 'Beard Cut',
    category: 'Grooming',
    tags: ['grooming', 'hair', 'personal-care'],
    reminder_interval_days: 14,
    archived: false,
    color: '#3B82F6', // Blue
    icon: 'Scissors',
  },
  {
    activity_id: 'act_laundry',
    name: 'Wash Clothes / Laundry',
    category: 'Chores',
    tags: ['chores', 'home', 'laundry'],
    reminder_interval_days: 7,
    archived: false,
    color: '#06B6D4', // Cyan
    icon: 'Shirt',
  },
  {
    activity_id: 'act_park_walk',
    name: 'Walk in the Park',
    category: 'Health & Wellbeing',
    tags: ['outdoors', 'health', 'walk'],
    reminder_interval_days: 3,
    archived: false,
    color: '#10B981', // Emerald
    icon: 'Trees',
  },
  {
    activity_id: 'act_change_bedsheets',
    name: 'Change Bedsheets',
    category: 'Home & Cleaning',
    tags: ['bedroom', 'hygiene', 'chores'],
    reminder_interval_days: 14,
    archived: false,
    color: '#8B5CF6', // Purple
    icon: 'BedDouble',
  },
  {
    activity_id: 'act_car_service',
    name: 'Vehicle Service & Checkup',
    category: 'Maintenance',
    tags: ['vehicle', 'car', 'maintenance'],
    reminder_interval_days: 90,
    archived: false,
    color: '#F59E0B', // Amber
    icon: 'Wrench',
  },
  {
    activity_id: 'act_water_plants',
    name: 'Water Houseplants',
    category: 'Home & Garden',
    tags: ['plants', 'home'],
    reminder_interval_days: 4,
    archived: false,
    color: '#14B8A6', // Teal
    icon: 'Droplets',
  },
  {
    activity_id: 'act_deep_clean',
    name: 'Deep Clean Apartment',
    category: 'Home & Cleaning',
    tags: ['cleaning', 'home'],
    reminder_interval_days: 30,
    archived: false,
    color: '#EC4899', // Pink
    icon: 'Sparkles',
  },
  {
    activity_id: 'act_gym_workout',
    name: 'Gym Workout',
    category: 'Health & Wellbeing',
    tags: ['fitness', 'exercise'],
    reminder_interval_days: 2,
    archived: false,
    color: '#EF4444', // Red
    icon: 'Dumbbell',
  },
];

export const COMMON_CATEGORIES = [
  'Grooming',
  'Chores',
  'Health & Wellbeing',
  'Home & Cleaning',
  'Home & Garden',
  'Maintenance',
  'Hobbies & Social',
  'Work & Admin',
];
