curl.exe http://localhost:4001/health
curl.exe http://localhost:4001/db-check

curl.exe -X POST http://localhost:4001/auth/login ^
  -H "Content-Type: application/json" ^
  -H "Origin: http://localhost:3000" ^
  -d "{\"email\":\"admin@demo.local\",\"password\":\"Admin123!\"}" ^
  -c cookies.txt

curl.exe -b cookies.txt http://localhost:4001/me

curl.exe -X POST http://localhost:4001/auth/refresh ^
  -H "Origin: http://localhost:3000" ^
  -b cookies.txt -c cookies.txt

curl.exe -X POST http://localhost:4001/auth/logout ^
  -H "Origin: http://localhost:3000" ^
  -b cookies.txt -c cookies.txt

curl.exe -b cookies.txt http://localhost:4001/me
