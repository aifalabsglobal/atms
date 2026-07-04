/** JNTUH R22 B.Tech ECE subject catalog — bundled for bulk import. */
export const JNTU_R22_ECE_CATALOG = {
  regulation: 'R22',
  programCode: 'BTECH-ECE',
  departmentCode: 'ECE',
  name: 'JNTUH R22 B.Tech Electronics & Communication Engineering',
  subjects: [
    { code: 'EC101BS', name: 'Mathematics-I (ECE)', semesterCode: 'I-I', credits: 3, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'BS', syllabus: 'Matrices, Eigen values, Partial differentiation, Multiple integrals' },
    { code: 'EC102ES', name: 'Network Analysis', semesterCode: 'I-I', credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'ES', syllabus: 'Network Theorems, Transient Analysis, Two-Port Networks, Filters' },
    { code: 'EC201PC', name: 'Electronic Devices and Circuits', semesterCode: 'II-I', credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'PN Junction, BJT, FET, Amplifiers, Oscillators, Operational Amplifiers' },
    { code: 'EC202PC', name: 'Signals and Systems', semesterCode: 'II-I', credits: 3, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'PC', syllabus: 'Continuous and Discrete Signals, Fourier Series, Fourier Transform, Laplace Transform, Z-Transform, Sampling Theorem' },
    { code: 'EC301PC', name: 'Analog Communications', semesterCode: 'III-I', credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Amplitude Modulation, Frequency Modulation, Receivers, Transmitters, Noise, Pulse Modulation' },
    { code: 'EC302PC', name: 'Digital Communications', semesterCode: 'III-I', credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'PCM, Delta Modulation, Baseband Transmission, Bandpass Modulation, Spread Spectrum, Information Theory' },
    { code: 'EC303PC', name: 'VLSI Design', semesterCode: 'III-II', credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'MOS Technology, CMOS Logic Design, Circuit Characterization, Subsystem Design, Testing' },
    { code: 'EC401PC', name: 'Embedded Systems', semesterCode: 'IV-I', credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Embedded System Concepts, ARM Architecture, RTOS, Device Drivers, Communication Protocols, IoT' },
  ],
} as const;
