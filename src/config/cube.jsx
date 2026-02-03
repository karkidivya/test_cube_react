
import cube from '@cubejs-client/core';


const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30';

// Initialize Cube.js API
export const cubeApi = cube(
  token,
  { apiUrl: 'https://cube.growthzilla.com/cubejs-api/v1/load', 
    options: {
      timezone: 'UTC' }
   }
  
);