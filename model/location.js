class Location {

    // `informazioni` (`IdInfo`, `Nome`, `Descrizione`, `Posti`)
    // manca il blocco (che sarebbe carino avere)
    constructor(locName, locDescription, locRoomNumber, locLevel, locFloor, locSeats) {
        this.myName = locName;
        this.myDescription = locDescription;
        this.myRoomNumber = locRoomNumber;
        this.myLevel = locLevel;
        this.myFloor = locFloor;
        this.mySeats = locSeats;
    }
  
    name() {
        return this.myName;
    }
    
    description() {
        return this.myDescription;
    }

    roomNumber() {
        return this.myRoomNumber;
    }

    level() {
        return this.myLevel;
    }

    floor() {
        return this.myFloor;
    }

    seats() {
        return this.mySeats;
    }

    /*
    path() {
        return 'this is location path';
    }
    */
}

 module.exports = Location;
