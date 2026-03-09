/**
 * Calculator for A2 formula
 */

interface CalculatorVariables {
    Xm: number;
    Xl: number;
    Ym: number;
    Yl: number;
    A0: number;
    A1: number;
    A2: number;
}

interface CalcUVariables {
    Xm: number;
    Xu: number;
    Ym: number;
    Yu: number;
    A0: number;
    A1: number;
    A2: number;
}

/**
 * Calculate A2 using the formula:
 * A2 = 3 * (Yl + Ym)/(Xm - Xl)^2 - 6 * (AR/(Xl - Xm)^3)
 */
function calculateA2(Xm: number, Xl: number, Ym: number, Yl: number): number {
    const AR  = 0.06;
   // 
    //ARea 1.1599999999999995
    const term1 = 3 * (Yl + Ym) / Math.pow(Xl - Xm, 2);
    const term2 = 6 * (AR / Math.pow(Xl - Xm, 3));
    const A2 = term1 - term2;
console.log('A2', A2)
    return A2;
}

function calculateA2Up(Xm: number, Xu: number, Ym: number, Yu: number): number {
    const AR  = 0.11//Y01m * (Xm - Xl) 3.7 * 11.74
   // 
  /* console.log('xm ', Xm)
      console.log('xu ', Xu)
         console.log('ym ', Ym)
            console.log('yo ', Yu)*/
    //ARea 1.1599999999999995
    const term1 = 3 * (Yu + Ym) / Math.pow(Xu - Xm, 2);
    const term2 = 6 * (AR / Math.pow(Xu - Xm, 3));
    const A2 = term1 - term2;
console.log('A2u', A2)
    return A2;
}

/**
 * Calculate A2 using the formula:
 * A1 = (Yl - Ym)/(Xl - Xm) - (Xl + Xm) * A2
 */
function calculateA1(Xm: number, Xl: number, Ym: number, Yl: number, A2: number): number {
    const A1 = (Yl - Ym) / (Xl - Xm) - ((Xl + Xm) * A2);
    console.log('A1', A1)
    return A1;
}
//  calculateA1up(Xm, Xu, Ym, yu, A2);
function calculateA1up(Xm: number, Xu: number, Ym: number, Yu: number, A2u: number): number {
    const A1 = (Yu - Ym) / (Xu - Xm) - ((Xu + Xm) * A2u);
    console.log('A1u', A1)
    return A1;
}

/**
 * Calculate A2 using the formula:
 * A1 = (Yl - Ym)/(Xl - Xm) - (Xl + Xm) * A2
 */
function calculateA0(Xm: number, Xl: number, Ym: number, Yl: number, A2: number): number {
    const A0 = (Ym - Xm) * (Yl - Ym)/(Xl -Xm) +  ((Xl * Xm) * A2);
    console.log('A0', A0)
    return A0;
}

function calculateA0u(Xm: number, Xu: number, Ym: number, Yu: number, A2: number): number {
    const A0 = (Ym - Xm) * (Yu - Ym)/(Xu -Xm) +  (Xu * Xm) * A2;
    console.log('A0', A0)
    return A0;
}
/**
 * Calculate A2 using the formula:
 * Y1 = A2 * Xl^2 + A1 * Xl + A0
 */
function calculateYl( Xl: number,A0: number, A1: number, A2: number): number {
    const Y_lower = A2 * Math.pow(Xl, 2) + A1 * Xl + A0;
    console.log('y lower', Y_lower)
    return Y_lower;
}
// calculateYu(Xu, A0, A1, A2);
function calculateYu( Xu: number,A0: number, A1: number, A2: number): number {
    const Y_lower = A2 * Math.pow(Xu, 2) + A1 * Xu + A0;
    console.log('yu lower', Y_lower)
    return Y_lower;
}
/**
 * Calculate A2 using the formula:
 * Y1 = A2 * Xl^2 + A1 * Xl + A0
 */
function calculateYm( Xm: number,A0: number, A1: number, A2: number): number {
    const Y_upper = A2 * Math.pow(Xm, 2) + A1 * Xm + A0;
     console.log('y upper', Y_upper)
    return Y_upper;
}

function calculateYmup( Xm: number,A0: number, A1: number, A2: number): number {
    const Y_upper = A2 * Math.pow(Xm, 2) + A1 * Xm + A0;
     console.log('yu upper', Y_upper)
    return Y_upper;
}

/**
 * Calculate A2 using the formula:
 * A1 = A2 * (Xm^3 - Xl^3)/3 + A1 * (Xm^2 - Xl^2)/2 + A0 * (Xm - Xl)
 */
function calculateAreaLower( Xm: number, Xl: number,A0: number, A1: number, A2: number): number {
    const Area_lower = A2 * (Math.pow(Xm,3) - Math.pow(Xl,3))/3 + A1 * (Math.pow(Xm,2) - Math.pow(Xl,2))/2 + A0 * (Xm - Xl);
        console.log('AL', Area_lower)
    return Area_lower;

}

function calculateYM(Xm: number, Xl: number, Xu: number, Ym: number, Yl: number, Yu: number,areaL: number, areaU: number){


 let y = (3 * ((areaL / Math.pow((Xm - Xl),2) + areaU / Math.pow((Xu - Xm), 2)) - (Yl / (Xm - Xl) + Yu / (Xu - Xm)))) / (2 * 1 / (Xm - Xl) + 1 / (Xu - Xm));
 console.log('YM ', y)
}

function calculateUpper(){

     const variables: CalcUVariables= {
    Xm: 15.25,
    Xu: 12,
    Ym: 0.0319,
    Yu: 0.0315,//1.8375,//4.7,//2.71 pdf
    A0: 6.76,
    A1: -1.008,
    A2: 0.037
};

calculateA2Up(variables.Xm, variables.Xu, variables.Ym, variables.Yu);
 calculateA1up(variables.Xm, variables.Xu, variables.Ym, variables.Yu, variables.A2)
 calculateA0u(variables.Xm, variables.Xu, variables.Ym, variables.Yu, variables.A2);
 calculateYu(variables.Xu, variables.A0, variables.A1, variables.A2);
calculateYmup(variables.Xm, variables.A0, variables.A1,variables.A2);
}

function calculateLower(){
    const variables: CalculatorVariables = {
    Xm: 24.5,
    Xl: 7.15,
    Ym: 0.029,//3.7,//1.94
    Yl: 0.0275,//1.8375,//4.7,//2.71 pdf
    A0: 0.99,
    A1: 0.043,
    A2: 0.087
};

// Calculate A2

calculateA2(variables.Xm, variables.Xl, variables.Ym, variables.Yl);
calculateA1(variables.Xm, variables.Xl, variables.Ym, variables.Yl, variables.A2);
calculateA0(variables.Xm, variables.Xl, variables.Ym, variables.Yl, variables.A2);
const Y_lower = calculateYl(variables.Xl, variables.A0, variables.A1, variables.A2);
const Y_upper = calculateYm(variables.Xm, variables.A0, variables.A1, variables.A2);

}

//calculateLower()
//calculateUpper()

//calculateYM(Xm: number, Xl: number, Xu: number, Ym: number, Yl: number, Yu: number,areaL: number, areaU: number)
//calculateYM(7.5,5.15, 9.5, 0.018,0.008, 0.025,0.05, 0.06)
//calculateYM(12,9.5, 15.25, 0.0276,0.018, 0.032,0.5, 0.6)
//calculateYM(15.25,12, 19.25, 0.0319,0.0276, 0.034,0.6, 0.085)

calculateYM(7.5,5.15,9.5, 0.029,0.018, 0.022,0.06, 0.085)//0.0298

//export {  calculateAreaLower, type CalculatorVariables };
export { calculateA2, type CalculatorVariables };

