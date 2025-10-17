import db from "../config/database.js";
import Game from "../models/Game.js";
import GamePlayer from "../models/GamePlayer.js";
import GameProperty from "../models/GameProperty.js";
import Property from "../models/Property.js";

const gamePropertyController = {
  async create(req, res) {
    try {
      const property = await GameProperty.create(req.body);
      res
        .status(201)
        .json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const property = await GameProperty.findById(req.params.id);
      if (!property)
        return res.status(404).json({ error: "Game property not found" });
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const properties = await GameProperty.findAll({
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByGame(req, res) {
    try {
      const properties = await GameProperty.findByGameId(req.params.gameId);
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async findByPlayer(req, res) {
    try {
      const properties = await GameProperty.findByPlayerId(req.params.playerId);
      res.json({ success: true, message: "successful", data: properties });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const property = await GameProperty.update(req.params.id, req.body);
      res.json({ success: true, message: "successful", data: property });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await GameProperty.delete(req.params.id);
      res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async buy(req, res) {
    const trx = await db.transaction();
    try {
      const { game_id, property_id, user_id } = req.body;

      // 1️⃣ Fetch game
      const game = await trx("games").where({ id: game_id }).first();
      if (!game) {
        await trx.rollback();
        return res.status(404).json({ error: "Game not found" });
      }
      if (game.status !== "RUNNING") {
        await trx.rollback();
        return res.status(422).json({ error: "Game is currently not running" });
      }

      // 2️⃣ Fetch player
      const player = await trx("game_players")
        .where({ user_id, game_id })
        .first();
      if (!player) {
        await trx.rollback();
        return res.status(404).json({ error: "Player not in game" });
      }

      // 3️⃣ Fetch property
      const property = await trx("properties")
        .where({ id: property_id })
        .first();
      if (!property) {
        await trx.rollback();
        return res.status(404).json({ error: "Property not found" });
      }

      // 4️⃣ Check if property already owned by someone in this game
      const existing = await trx("game_properties")
        .where({ property_id, game_id })
        .first();
      if (existing) {
        await trx.rollback();
        return res
          .status(422)
          .json({ error: "Game property not available for purchase" });
      }

      // 5️⃣ Check player balance
      if (Number(player.balance) < Number(property.price)) {
        await trx.rollback();
        return res.status(422).json({ error: "Insufficient balance" });
      }

      // 6️⃣ Deduct balance
      await trx("game_players")
        .where({ id: player.id })
        .update({
          balance: Number(player.balance) - Number(property.price),
          updated_at: db.fn.now(),
        });

      // 7️⃣ Assign property to player
      await trx("game_properties").insert({
        game_id: game.id,
        property_id: property.id,
        player_id: player.id,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });

      await trx.commit();
      return res.json({ success: true, message: "successful", data: null });
    } catch (error) {
      await trx.rollback();
      console.error("Transaction failed:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },
};

export default gamePropertyController;
