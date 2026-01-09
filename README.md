# cth-dmps-api

API web service for searching and retrieving DMPs from Chalmers University of Technology in RDA Common maDMP 1.2 format, using the Common Machine-Actionable DMP API specifications (https://rda-dmp-common.github.io/common-madmp-api) or (for now) standard Lucene queries. 

Before getting started, make sure you have installed [Node.js](https://nodejs.org/en/) and [Visual Studio Code](https://code.visualstudio.com/), and of course that you have access to an ES index containing records in maDMP JSON format.  

1. Clone this repository.
2. Run *npm install* from inside the directory.
3. Make a copy of *.env_example*.
4. Change the name of the copied file to *.env*
5. Add configurations to the *.env* file (you can try the project without adding anything).
6. Open the folder in *Visual Studio Code*.
7. Open *app.js* and click *f5* to run the project.
8. Go to localhost:3000 in your browser or REST client.

A script for creating maDMP JSON records from DS Wizard is avilable at https://github.com/ChalmersLibrary/dsw2es.

## Notes  
* This app currently only supports the GET method and selected search options and filters. It is also possible to use Lucene queries in the "query" request param.    
* Using Elasticsearch 7 or over might require some code changes.

## Documentation
todo
